// Turns the text of a "Compatibility report" issue form into a draft report file.
//
// The issue text is untrusted. Nothing from it is ever concatenated into YAML:
// the draft is built as an object, validated against schema/report.schema.json
// and only then serialised with a YAML library. The result is a draft for a
// maintainer to review, never something that is written into data/ automatically.
import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { stringify } from "yaml";
import { REPO_ROOT } from "./lib.mjs";

export const FORM_FIELDS = {
  app: "App and version",
  runner: "Runner and version",
  distro: "Linux distribution",
  result: "Result",
  tweaks: "Tweaks needed",
  notes: "Notes",
};
const STATUSES = ["platinum", "gold", "silver", "bronze", "borked"];
const MAX_NOTES = 1000;

let validator;
function reportValidator() {
  if (!validator) {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    validator = ajv.compile(JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "schema", "report.schema.json"), "utf8")));
  }
  return validator;
}

/** One printable line: no control characters, collapsed whitespace. */
function oneLine(value) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/\s+/g, " ").trim();
}

/** Multi-line text without control characters (newlines are kept). */
function multiLine(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Split an issue-form body ("### Label" sections) into { label: text }. */
export function parseIssueForm(body) {
  const text = String(body ?? "").replace(/\r\n?/g, "\n");
  const fields = {};
  const parts = text.split(/^###[ \t]+(.+?)[ \t]*$/m);
  for (let i = 1; i < parts.length; i += 2) {
    const value = parts[i + 1].trim();
    fields[parts[i].trim()] = /^_?no response_?$/i.test(value) ? "" : value;
  }
  return fields;
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Find the catalog app at the start of "AutoCAD 2024"; the rest is the app version. */
export function matchApp(text, apps) {
  const input = oneLine(text);
  let best = null;
  let tie = false;
  for (const app of apps) {
    for (const name of [app.name, ...(app.aliases || []), app.id.replace(/-/g, " ")]) {
      const m = new RegExp(`^${escapeRegex(oneLine(name))}(?![\\p{L}\\p{N}])[\\s:,/()-]*(.*)$`, "iu").exec(input);
      if (!m) continue;
      const length = oneLine(name).length;
      if (!best || length > best.length) {
        best = { app, length, rest: m[1] };
        tie = false;
      } else if (length === best.length && app.id !== best.app.id) {
        tie = true;
      }
    }
  }
  if (!best) return { error: `App not found in the catalog: "${input.slice(0, 80)}". Add the app first or fix the name.` };
  if (tie) return { error: `The app name "${input.slice(0, 80)}" matches more than one catalog entry. Use the full name.` };
  const version = best.rest.replace(/^(?:version|ver\.?|v)\s+/i, "").trim();
  return { app: best.app, version };
}

export function parseRunner(text) {
  const input = oneLine(text);
  const known = /^(wine|proton|bottles|crossover)(?![a-z])[\s_:,-]*(.*)$/i.exec(input);
  if (known) return { type: known[1].toLowerCase(), version: known[2].trim() };
  if (/^(vm|virtual machine|virtualbox|vmware|qemu|kvm|virt-manager)\b/i.test(input)) return { type: "vm", version: input };
  return { type: "other", version: input, guessed: true };
}

/** Pull structured tweaks out of free text; anything unrecognised is returned as `rest`. */
export function parseTweaks(text) {
  const tweaks = {};
  const rest = [];
  for (const raw of multiLine(text).split("\n")) {
    const line = raw.trim().replace(/^[-*•]\s*/, "");
    if (!line) continue;
    let m;
    if ((m = /^winetricks\s*[:=]?\s*(.+)$/i.exec(line))) {
      const verbs = m[1].split(/[\s,;]+/).map((v) => v.toLowerCase()).filter(Boolean);
      // Stricter than the schema: a verb is a plain name, never something that looks like a flag.
      const good = verbs.filter((v) => /^[a-z0-9][a-z0-9_.-]*$/.test(v));
      if (good.length) tweaks.winetricks = [...new Set([...(tweaks.winetricks || []), ...good])];
      if (good.length !== verbs.length) rest.push(line);
    } else if ((m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line))) {
      tweaks.env = { ...(tweaks.env || {}), [m[1]]: m[2].trim().replace(/^(["'])(.*)\1$/, "$2").slice(0, 200) };
    } else if ((m = /^windows(?:\s*version)?\s*[:=]?\s*(.+)$/i.exec(line)) && m[1].length <= 40) {
      tweaks.windows_version = m[1].trim();
    } else {
      rest.push(line);
    }
  }
  return { tweaks, rest };
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);
}

const slug = (value, max = 40) =>
  String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max).replace(/-+$/g, "");

/**
 * Build a draft from an issue body.
 * @param {string} body  issue text
 * @param {Array<{id:string,name:string,aliases?:string[]}>} apps  catalog apps
 * @param {{reporter?:string,date?:string}} options  taken from the issue, not from the text
 */
export function draftReport(body, apps, { reporter, date } = {}) {
  const errors = [];
  const warnings = [];
  const fields = parseIssueForm(body);
  for (const label of Object.values(FORM_FIELDS)) {
    if (!(label in fields)) errors.push(`The issue text has no "${label}" section. Use the Compatibility report form.`);
  }
  if (errors.length) return { errors, warnings };

  const app = matchApp(fields[FORM_FIELDS.app], apps);
  if (app.error) errors.push(app.error);
  else if (!app.version) errors.push('The app version is missing (for example "AutoCAD 2024").');

  const runner = parseRunner(fields[FORM_FIELDS.runner]);
  if (!runner.version) errors.push('The runner version is missing (for example "Wine 9.0").');
  if (runner.guessed) warnings.push(`Runner type not recognised, recorded as "other": "${runner.version.slice(0, 60)}". Check it.`);

  const status = oneLine(fields[FORM_FIELDS.result]).split(/[\s(]/)[0].toLowerCase();
  if (!STATUSES.includes(status)) errors.push(`The result must be one of ${STATUSES.join(", ")}.`);

  const distro = oneLine(fields[FORM_FIELDS.distro]);
  const { tweaks, rest } = parseTweaks(fields[FORM_FIELDS.tweaks]);
  const notesText = multiLine(fields[FORM_FIELDS.notes]);
  const notes = [rest.length ? `Reported adjustments (not structured): ${rest.join("; ")}` : "", notesText]
    .filter(Boolean).join("\n\n");
  if (notes.length > MAX_NOTES) errors.push(`Notes and unstructured adjustments are ${notes.length} characters; the limit is ${MAX_NOTES}. Shorten them.`);

  const who = oneLine(reporter);
  if (!who) errors.push("The reporter's GitHub handle is required (use --reporter; take it from the issue author).");
  const when = date ?? new Date().toISOString().slice(0, 10);
  if (!validDate(when)) errors.push(`The date must be a real date written YYYY-MM-DD, got "${when}".`);

  if (errors.length) return { errors, warnings };

  const report = {
    app: app.app.id,
    app_version: oneLine(app.version),
    runner: { type: runner.type, version: oneLine(runner.version) },
    distro,
    status,
    ...(Object.keys(tweaks).length ? { tweaks } : {}),
    ...(notes ? { notes } : {}),
    reporter: who,
    date: when,
  };

  const validate = reportValidator();
  if (!validate(report)) {
    for (const e of validate.errors) errors.push(`${e.instancePath || "(report)"} ${e.message}`);
    return { errors, warnings };
  }

  const file = [when, report.runner.type, slug(report.runner.version, 16), slug(distro, 20), slug(who, 20)]
    .filter(Boolean).join("-") + ".yaml";
  const header = [
    "# DRAFT generated from an issue. Check every field against the issue before adding it.",
    "# Reporter and date come from the issue metadata, not from the issue text.",
    `# Suggested path: data/reports/${report.app}/${file}`,
    "",
  ].join("\n");
  return { errors, warnings, report, path: `data/reports/${report.app}/${file}`, yaml: header + stringify(report, { lineWidth: 0 }) };
}
