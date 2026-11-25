const PROFESSIONAL = new Set(["cad", "engineering", "accounting", "printing", "audio"]);

// Keep catalog text literal in Markdown, including text that resembles HTML or checkboxes.
function plain(value) {
  return String(value).replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/[\\`*_[\]{}()#!|~]/g, "\\$&");
}

function code(value) {
  const text = String(value).replace(/[\u0000-\u001f\u007f-\u009f]/g, " ");
  const longest = Math.max(0, ...(text.match(/`+/g) || []).map((run) => run.length));
  const fence = "`".repeat(longest + 1);
  return `${fence} ${text} ${fence}`;
}

function source(value) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Invalid source");
    const href = url.href.replace(/[()<>\\]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
    return `[${plain(value)}](<${href}>)`;
  } catch {
    return `${plain(value)} (not a public HTTP(S) source URL)`;
  }
}

function draft(appEntry, alternatives, reports) {
  const app = appEntry.data;
  const lines = [
    "### Scope", "",
    `Review ${plain(app.name)} by ${plain(app.vendor)} in ${code(`data/${appEntry.file}`)}.`, "",
    "This is an unverified catalog entry. The values below are claims to investigate, not confirmed facts. A small correction is useful even when the full entry cannot yet be verified.", "",
    `- Category: ${plain(app.category)}`,
    `- Aliases: ${app.aliases?.length ? app.aliases.map(plain).join(", ") : "none recorded"}`,
    `- Homepage: ${app.homepage ? source(app.homepage) : "not recorded; find an official source"}`,
    "",
    "### Current comparison claims", "",
  ];
  if (!app.alternatives.length) lines.push("No alternatives are listed. Investigate candidates without guessing their suitability.", "");
  for (const comparison of app.alternatives) {
    const entry = alternatives.get(comparison.id);
    if (!entry) throw new Error(`Unknown alternative: ${comparison.id}`);
    const alt = entry.data;
    lines.push(
      `#### ${plain(alt.name)} (${plain(alt.id)})`, "",
      `- Shared file: ${code(`data/${entry.file}`)}`,
      `- Fit: ${plain(comparison.fit)}`,
      `- Import formats: ${comparison.file_formats?.import?.length ? comparison.file_formats.import.map(plain).join(", ") : "not recorded"}`,
      `- Export formats: ${comparison.file_formats?.export?.length ? comparison.file_formats.export.map(plain).join(", ") : "not recorded"}`,
      `- Shortcuts: ${comparison.shortcuts ? plain(comparison.shortcuts) : "not recorded"}`,
    );
    if (comparison.missing?.length) {
      lines.push("- Claimed missing features:");
      for (const feature of comparison.missing) lines.push(`  - ${plain(feature)}`);
    }
    if (comparison.notes) lines.push(`- Comparison notes: ${plain(comparison.notes)}`);
    lines.push("- Comparison sources:");
    for (const url of comparison.sources || []) lines.push(`  - ${source(url)}`);
    if (!comparison.sources?.length) lines.push("  - Missing: add claim-specific documentation or reproducible test evidence.");
    lines.push(
      `- Alternative homepage: ${source(alt.homepage)}`,
      `- Recorded license: ${plain(alt.license)}`,
    );
    if (alt.description) lines.push(`- Recorded description: ${plain(alt.description)}`);
    lines.push("", "Installation metadata to cross-check with the listed sources (availability is not a tested support guarantee):", "");
    if (!alt.install.length) lines.push("No installation routes are recorded.", "");
    for (const [index, route] of alt.install.entries()) {
      lines.push(
        `- Route ${index + 1}: ${code(route.method)} / ${code(route.ref)}${route.classic ? " / classic confinement" : ""}`,
        `  - Distributions: ${route.distros?.length ? route.distros.map(plain).join(", ") : "not recorded"}`,
        `  - Requirements: ${route.notes ? plain(route.notes) : "not recorded"}`,
      );
      for (const url of route.sources || []) lines.push(`  - Source: ${source(url)}`);
      if (!route.sources?.length) lines.push("  - Sources: missing");
    }
    lines.push("");
  }
  lines.push("### Wine / Proton context", "");
  if (app.wine?.summary) lines.push(`Current context to verify: ${plain(app.wine.summary)}`, "");
  if (app.wine?.appdb_url) lines.push(`Reference: ${source(app.wine.appdb_url)}`, "");
  lines.push(`Compatibility report files: ${reports.length}. Existing reports are evidence only for their recorded versions and environments.`);
  for (const report of reports) lines.push(`- ${code(`data/${report.file}`)}`);
  if (!reports.length) lines.push("No compatibility reports are recorded. Keep the result untested; do not infer Wine or Proton compatibility from a native alternative.");
  lines.push(
    "", "### Evidence to add", "",
    "Record each checked claim, a direct source or reproducible test, relevant versions and environment, and the date checked. Correct or remove unsupported claims. A reachable homepage alone is not evidence for a feature or a fit rating.", "",
    "| Claim / field | Source or reproducible test | Versions / environment | Date and result |",
    "| --- | --- | --- | --- |",
    "| | | | |", "",
    "### Review checklist", "",
    "- [ ] Check the app identity, aliases, category and homepage.",
    "- [ ] Support or correct every comparison claim: fit, import/export, shortcuts, limitations and notes.",
    "- [ ] Check related shared alternative metadata and installation sources; describe release, architecture and repository limits without claiming untested support.",
    "- [ ] Keep wording neutral and original; do not copy text from other databases or vendor pages.",
    "- [ ] Keep unsupported compatibility unknown; add a separate report only for an actual test with versions, environment, date and reporter.",
    "- [ ] Run npm run check after the corrections.",
    "- [ ] A reviewer other than the change author has checked the evidence and recorded the outcome in the pull request.",
    "- [ ] Leave verified: false until the complete app entry has evidence and independent review. Partial fixes do not verify the remaining claims.",
    "",
    "The verified flag describes the app entry. It does not certify all distributions or replace version-specific compatibility reports. Record the review date and evidence in the pull request; the data schema currently has no verification-date field.",
    "",
  );
  return lines.join("\n");
}

/** Build review drafts from validated entries, without modifying the catalog or contacting a service. */
export function buildReviewTasks(entries, { app: appId, category, limit } = {}) {
  const apps = entries.filter((entry) => entry.kind === "app");
  const alternatives = new Map(entries.filter((entry) => entry.kind === "alternative").map((entry) => [entry.data.id, entry]));
  if (appId && !apps.some((entry) => entry.data.id === appId)) throw new Error(`Unknown app: ${appId}`);
  const counts = new Map();
  for (const { data } of apps) counts.set(data.category, (counts.get(data.category) || 0) + 1);
  const reports = new Map();
  for (const entry of entries.filter((item) => item.kind === "report")) {
    if (!reports.has(entry.data.app)) reports.set(entry.data.app, []);
    reports.get(entry.data.app).push(entry);
  }
  const unverified = apps.filter((entry) => entry.data.verified !== true);
  const candidates = unverified.filter(({ data }) => (!appId || data.id === appId) && (!category || data.category === category));
  candidates.sort((a, b) => {
    const x = a.data, y = b.data;
    const professional = Number(PROFESSIONAL.has(y.category)) - Number(PROFESSIONAL.has(x.category));
    return professional || (PROFESSIONAL.has(x.category) ? counts.get(x.category) - counts.get(y.category) : 0) ||
      x.category.localeCompare(y.category, "en") || x.id.localeCompare(y.id, "en");
  });
  const tasks = candidates.slice(0, limit).map((entry) => ({
    id: entry.data.id, title: `Verify entry: ${String(entry.data.name).replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")}`,
    labels: ["verification", "good first issue"], category: entry.data.category,
    file: `data/${entry.file}`, body: draft(entry, alternatives, (reports.get(entry.data.id) || []).sort((a, b) => a.file.localeCompare(b.file, "en"))),
  }));
  return {
    task_version: 1, unverified_total: unverified.length, matching_total: candidates.length, selected_total: tasks.length,
    filters: { app: appId || null, category: category || null, limit: limit ?? null }, tasks,
  };
}

export function reviewMarkdown(backlog) {
  const lines = [
    "# Verification task drafts", "",
    `${backlog.selected_total} selected from ${backlog.matching_total} matching entries; ${backlog.unverified_total} unverified apps in the catalog.`, "",
    "These drafts are generated locally from current data. No issues have been opened and no verification flags have changed. Regenerate after editing the catalog; drafts are not a source of truth.", "",
    "Professional categories come first, with the fewest apps first; remaining categories and app ids sort alphabetically. This is coverage ordering, not popularity or a difficulty estimate.", "",
    "Review each draft before copying it into an issue. Labels are suggestions and must exist in the repository before they can be applied. The JSON report contains each title, suggested labels and body separately.", "",
  ];
  if (!backlog.tasks.length) lines.push("No unverified entries match these filters.", "");
  for (const task of backlog.tasks) {
    lines.push(`## ${plain(task.title)}`, "", `Suggested labels: ${task.labels.map(code).join(", ")}`, "", task.body);
  }
  return lines.join("\n");
}
