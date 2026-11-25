// Shared loading, validation and build logic for the database.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SCHEMA_FILES = {
  app: "app.schema.json",
  alternative: "alternative.schema.json",
  report: "report.schema.json",
};

// Order used to rank statuses (best first).
export const STATUS_ORDER = ["platinum", "gold", "silver", "bronze", "borked"];

const FILENAME = /^[a-z0-9][a-z0-9._-]*\.yaml$/;

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out.sort();
}

function loadSchemas() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validators = {};
  for (const [kind, file] of Object.entries(SCHEMA_FILES)) {
    const schema = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "schema", file), "utf8"));
    validators[kind] = ajv.compile(schema);
  }
  return validators;
}

function formatAjvErrors(errors) {
  return errors.map((e) => {
    const extra = e.params && e.params.additionalProperty ? ` "${e.params.additionalProperty}"` : "";
    return `${e.instancePath || "(root)"} ${e.message}${extra}`;
  });
}

/**
 * Load every data file under `dataDir`. Files starting with "_" (templates) are skipped.
 * Returns { entries, errors } where entries have { kind, file, data }.
 */
export function loadData(dataDir) {
  const entries = [];
  const errors = [];
  const groups = [
    ["app", path.join(dataDir, "apps")],
    ["alternative", path.join(dataDir, "alternatives")],
    ["report", path.join(dataDir, "reports")],
  ];
  for (const [kind, dir] of groups) {
    for (const full of listFiles(dir)) {
      const rel = path.relative(dataDir, full).split(path.sep).join("/");
      const base = path.basename(full);
      if (base.startsWith("_") || base === ".gitkeep") continue;
      if (!FILENAME.test(base)) {
        errors.push(`${rel}: file name must be lowercase, end in ".yaml" and use only a-z 0-9 . _ -`);
        continue;
      }
      let data;
      try {
        data = parse(fs.readFileSync(full, "utf8"));
      } catch (e) {
        errors.push(`${rel}: invalid YAML: ${e.message.split("\n")[0]}`);
        continue;
      }
      entries.push({ kind, file: rel, data });
    }
  }
  return { entries, errors };
}

/** Validate a data directory. Returns an array of human-readable error strings. */
export function validateData(dataDir, { now = new Date() } = {}) {
  const validators = loadSchemas();
  const { entries, errors } = loadData(dataDir);

  const apps = new Map();
  const alternatives = new Map();
  const valid = [];

  for (const entry of entries) {
    const { kind, file, data } = entry;
    const validate = validators[kind];
    if (!validate(data)) {
      for (const msg of formatAjvErrors(validate.errors)) errors.push(`${file}: ${msg}`);
      continue;
    }
    valid.push(entry);
    if (kind === "app" && data.verified_on > now.toISOString().slice(0, 10)) {
      errors.push(`${file}: verified_on must not be in the future (UTC)`);
    }
    const base = path.basename(file, ".yaml");
    if (kind === "app" || kind === "alternative") {
      if (data.id !== base) errors.push(`${file}: id "${data.id}" must equal the file name "${base}"`);
      const registry = kind === "app" ? apps : alternatives;
      if (registry.has(data.id)) errors.push(`${file}: duplicate ${kind} id "${data.id}"`);
      registry.set(data.id, { file, data });
    }
  }

  for (const { file, data } of apps.values()) {
    const seen = new Set();
    for (const link of data.alternatives) {
      if (!alternatives.has(link.id)) {
        errors.push(`${file}: alternative "${link.id}" does not exist in data/alternatives/`);
      }
      if (seen.has(link.id)) errors.push(`${file}: alternative "${link.id}" is listed twice`);
      seen.add(link.id);
    }
  }

  for (const { kind, file, data } of valid) {
    if (kind !== "report") continue;
    const folder = file.split("/")[1];
    if (folder !== data.app) {
      errors.push(`${file}: report for "${data.app}" must live in data/reports/${data.app}/`);
    }
    if (!apps.has(data.app)) errors.push(`${file}: app "${data.app}" does not exist in data/apps/`);
  }

  return errors;
}

/** Headline status from reports: most common status; ties go to the most recent report. */
export function summariseReports(reports) {
  if (reports.length === 0) return { status: "untested", report_count: 0 };
  const counts = new Map();
  for (const r of reports) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
  const top = Math.max(...counts.values());
  const leaders = new Set([...counts].filter(([, n]) => n === top).map(([s]) => s));
  const newestFirst = [...reports].sort((a, b) => b.date.localeCompare(a.date));
  const status = newestFirst.find((r) => leaders.has(r.status)).status;
  return { status, report_count: reports.length, last_report: newestFirst[0].date };
}

/** Build the denormalised JSON documents served by the API and packages. */
export function buildDist(dataDir) {
  const errors = validateData(dataDir);
  if (errors.length) {
    const err = new Error(`Data is invalid (${errors.length} error(s)). Run "npm run validate".`);
    err.validationErrors = errors;
    throw err;
  }
  const { entries } = loadData(dataDir);
  const alts = entries.filter((e) => e.kind === "alternative").map((e) => e.data);
  const altById = new Map(alts.map((a) => [a.id, a]));
  const reportsByApp = new Map();
  for (const { kind, data } of entries) {
    if (kind !== "report") continue;
    if (!reportsByApp.has(data.app)) reportsByApp.set(data.app, []);
    reportsByApp.get(data.app).push(data);
  }

  const apps = entries
    .filter((e) => e.kind === "app")
    .map((e) => e.data)
    .map((app) => {
      const reports = reportsByApp.get(app.id) ?? [];
      return {
        ...app,
        verified: app.verified ?? false,
        alternatives: app.alternatives.map((link) => ({ ...link, alternative: altById.get(link.id) })),
        wine: { ...app.wine, ...summariseReports(reports) },
        reports,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const index = apps.map((a) => ({
    id: a.id,
    name: a.name,
    aliases: a.aliases ?? [],
    vendor: a.vendor,
    category: a.category,
    alternatives: a.alternatives.map((l) => l.id),
    wine_status: a.wine.status,
  }));

  return {
    apps,
    alternatives: [...alts].sort((a, b) => a.id.localeCompare(b.id)),
    index,
  };
}
