import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { REPO_ROOT } from "./lib.mjs";
import { buildReviewTasks, reviewMarkdown } from "./review.mjs";

const app = (id, category = "graphics", extra = {}) => ({
  kind: "app", file: `apps/${id}.yaml`,
  data: { id, name: id, vendor: "Example", category, verified: false, alternatives: [], ...extra },
});
const alt = (extra = {}) => ({
  kind: "alternative", file: "alternatives/editor.yaml",
  data: { id: "editor", name: "Editor", homepage: "https://example.org/", license: "MIT", install: [], ...extra },
});

test("review tasks exclude verified apps, prefer thin professional categories and do not change input", () => {
  const entries = [app("graphics"), app("cad-one", "cad"), app("cad-two", "cad", { verified: true }), app("audio", "audio"), app("engineering", "engineering"), app("legacy", "office", { verified: undefined })];
  const original = structuredClone(entries);
  const backlog = buildReviewTasks(entries);
  assert.deepEqual(backlog.tasks.map((task) => task.id), ["audio", "engineering", "cad-one", "graphics", "legacy"]);
  assert.equal(backlog.unverified_total, 5);
  assert.equal(backlog.matching_total, 5);
  assert.deepEqual(entries, original);
  assert.deepEqual(buildReviewTasks([...entries].reverse()), backlog);
  assert.deepEqual(buildReviewTasks(entries, { category: "cad", limit: 1 }).tasks.map((task) => task.id), ["cad-one"]);
  assert.deepEqual(buildReviewTasks(entries, { app: "graphics", limit: 1 }).tasks.map((task) => task.id), ["graphics"]);
  assert.equal(buildReviewTasks(entries, { app: "cad-two" }).selected_total, 0);
  assert.equal(buildReviewTasks(entries, { app: "graphics", category: "audio" }).matching_total, 0);
  assert.equal(buildReviewTasks(entries, { limit: 2 }).matching_total, 5);
  assert.equal(buildReviewTasks(entries, { limit: 2 }).selected_total, 2);
  assert.throws(() => buildReviewTasks(entries, { app: "unknown" }), /Unknown app/);
});

test("drafts retain comparison claims, install scopes, sources and report references without inventing evidence", () => {
  const entries = [app("suite", "office", {
    homepage: "https://example.org/suite", aliases: ["Old Suite"],
    wine: { summary: "Printing needs a test.", appdb_url: "https://example.org/report" },
    alternatives: [{ id: "editor", fit: "partial", file_formats: { import: ["docx"], export: ["odt"] }, shortcuts: "different", missing: ["Mail merge"], notes: "Check macros.", sources: ["https://example.org/formats"] }],
  }), alt({ description: "Document editor.", install: [
    { method: "apt", ref: "editor", distros: ["debian"], sources: ["https://example.org/debian/editor"], notes: "Release 13, x86_64." },
    { method: "snap", ref: "editor", distros: ["ubuntu"], sources: ["https://example.org/snap/editor"], notes: "Requires snapd.", classic: true },
  ] }), { kind: "report", file: "reports/suite/check.yaml", data: { app: "suite" } }];
  const [task] = buildReviewTasks(entries).tasks;
  for (const value of ["Old Suite", "partial", "docx", "odt", "different", "Mail merge", "Check macros.", "https://example.org/formats", "Printing needs a test.", "data/reports/suite/check.yaml", "data/alternatives/editor.yaml", "debian", "ubuntu", "Release 13, x86", "Requires snapd.", "classic confinement", "https://example.org/debian/editor"]) assert.ok(task.body.includes(value), value);
  assert.match(task.body, /Compatibility report files: 1/);
  assert.match(task.body, /reviewer other than the change author/);
  assert.match(task.body, /Leave verified: false/);
  assert.doesNotMatch(task.body, /\[x\]/i);
  assert.deepEqual(task.labels, ["verification", "good first issue"]);
});

test("missing claims and evidence remain explicitly unknown in task drafts", () => {
  const [task] = buildReviewTasks([app("suite", "office", { alternatives: [{ id: "editor", fit: "minimal" }] }), alt({ install: [{ method: "apt", ref: "editor" }] })]).tasks;
  for (const expected of ["not recorded; find an official source", "Import formats: not recorded", "Export formats: not recorded", "Shortcuts: not recorded", "Missing: add claim-specific", "Distributions: not recorded", "Requirements: not recorded", "Sources: missing", "No compatibility reports are recorded", "Keep the result untested"]) assert.ok(task.body.includes(expected), expected);
  assert.match(reviewMarkdown(buildReviewTasks([])), /No unverified entries match/);
  assert.match(reviewMarkdown(buildReviewTasks([])), /No issues have been opened/);
});

test("catalog text cannot insert Markdown tasks, links, tables or HTML in review drafts", () => {
  const name = '<img src=x>\n- [x] done | [link](javascript:bad) &copy;';
  const [task] = buildReviewTasks([app("suite", "office", {
    name, homepage: "javascript:bad", alternatives: [{ id: "editor", fit: "partial", notes: "```\n# heading", sources: ["https://example.org/a)b", "https://user:secret@example.org/"] }],
  }), alt({ name, description: "<script>bad</script>" })]).tasks;
  assert.doesNotMatch(task.body, /<img|<script>|\n- \[x\]|\[link\]\(javascript:|\n# heading|\]\(<https:\/\/user:secret/);
  assert.ok(task.body.includes("https://example.org/a%29b"));
  assert.ok(task.body.includes("&amp;copy;"));
  assert.ok(task.body.includes("not a public HTTP(S) source URL"));
  assert.doesNotMatch(task.title, /[\r\n]/);
  assert.doesNotMatch(reviewMarkdown({ ...buildReviewTasks([]), tasks: [task] }), /<img|<script>/);
});

test("invalid CLI filters fail before overwriting generated drafts", () => {
  const files = ["verification.json", "verification.md"].map((file) => path.join(REPO_ROOT, "dist", "review", file));
  const before = files.map((file) => fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null);
  for (const args of [["--limit", "0"], ["--limit", "1e2"], ["--category", "unknown"], ["--app", "../outside"], ["--app"], ["--limit", "--app", "autocad"], ["--limit", "1", "--limit", "2"], ["--unexpected"], ["--app", "nonexistent-review-test-app"]]) {
    const result = spawnSync(process.execPath, [path.join(REPO_ROOT, "tools", "review-tasks.mjs"), ...args], { encoding: "utf8" });
    assert.equal(result.status, 1, JSON.stringify(args));
    assert.ok(result.stderr.trim(), JSON.stringify(args));
  }
  assert.deepEqual(files.map((file) => fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null), before);
});
