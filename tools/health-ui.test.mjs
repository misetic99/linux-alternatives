import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../site/health.js", import.meta.url), "utf8");
class Node {
  constructor(tagName) { this.tagName = tagName; this.nodes = []; this.value = ""; this.events = {}; this.attributes = {}; }
  get textContent() { return this.value + this.nodes.map((node) => node.textContent).join(""); }
  set textContent(value) { this.value = String(value); this.nodes = []; }
  set innerHTML(value) { throw new Error("HTML rendering is not allowed"); }
  append(...nodes) { this.nodes.push(...nodes); }
  replaceChildren(...nodes) { this.nodes = nodes; this.value = ""; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, value) { this.events[name] = value; }
}
const ids = ["health-updated", "health-stats", "category-summary", "health-categories", "health-review", "health-freshness", "link-summary", "link-counts", "link-filter", "link-list-count", "health-links", "more-links", "health-content", "health-error"];
async function render(data, fail = false) {
  const nodes = Object.fromEntries(ids.map((id) => [id, new Node("div")]));
  nodes["health-content"].hidden = true;
  nodes["health-error"].hidden = true;
  vm.runInNewContext(source, {
    URL,
    document: { createElement: (tag) => new Node(tag), getElementById: (id) => nodes[id] },
    fetch: async () => ({ ok: !fail, status: 500, json: async () => data }),
  });
  await new Promise(setImmediate);
  return nodes;
}
const fixture = (links = {}) => ({
  generated_at: "2026-11-24T12:00:00Z",
  counts: { apps: 1, alternatives: 1, verified_apps: 0, verified_percent: 0, reports: 0, apps_with_reports: 0, install_routes: 1, sourced_install_routes: 1, unique_urls: 1, covered_categories: 0, target_categories: 2 },
  categories: [{ id: "printing", apps: 0, verified: 0, reports: 0, alternatives: 0 }],
  review: { without_comparison_sources: [], without_alternatives: [], unverified: [{ id: "x", name: '<img src=x onerror="alert(1)">', category: "office" }], incomplete_install_metadata: [], reports_over_one_year_old: 0, latest_report: null, verifications_over_one_year_old: [], latest_verification: null },
  links: { state: "missing", results: [], counts: null, ...links },
});
function find(node, tag) { return [...(node.tagName === tag ? [node] : []), ...node.nodes.flatMap((child) => find(child, tag))]; }

test("dashboard exposes empty categories and missing evidence without interpreting it as healthy", async () => {
  const nodes = await render(fixture());
  assert.match(nodes["health-categories"].textContent, /0 · no entries/);
  assert.match(nodes["link-summary"].textContent, /availability is unknown/);
  assert.equal(nodes["link-filter"].disabled, true);
  assert.equal(nodes["health-content"].hidden, false);
  assert.equal(nodes["health-error"].hidden, true);
  assert.match(nodes["health-review"].textContent, /<img src=x/);
  assert.equal(find(nodes["health-review"], "img").length, 0);
  assert.match(find(nodes["health-review"], "a")[0].href, /^\.\/\?q=%3Cimg/);
  assert.match(nodes["health-freshness"].textContent, /No complete independent reviews/);
});

test("dashboard shows dated review queues and explains the freshness threshold", async () => {
  const data = fixture();
  data.review.latest_verification = "2026-11-24";
  data.review.verifications_over_one_year_old = [{ id: "old", name: "Old entry", category: "office", verified_on: "2025-01-01" }];
  const nodes = await render(data);
  assert.match(nodes["health-freshness"].textContent, /Latest complete review: 2026-11-24/);
  assert.match(nodes["health-freshness"].textContent, /Verifications older than one year \(365 days\): 1/);
  assert.match(nodes["health-freshness"].textContent, /remain verified/);
  assert.match(nodes["health-review"].textContent, /Verifications more than one year old \(1\).*Old entryofficeVerified: 2025-01-01/);
  assert.ok(find(nodes["health-review"], "a").some((node) => node.href === "./?q=Old%20entry"));
});

test("link review is paginated and can be filtered to a specific result", async () => {
  const results = Array.from({ length: 35 }, (_, index) => ({ url: `https://example.org/${index}`, state: index < 33 ? "blocked" : "broken", status: index < 33 ? 403 : 404, references: [{ file: "apps/example.yaml", field: "homepage" }] }));
  const nodes = await render(fixture({ state: "stale", checked_at: "2026-11-01T12:00:00Z", total: 35, counts: { blocked: 33, broken: 2 }, results }));
  assert.match(nodes["link-summary"].textContent, /more than 14 days old/);
  assert.equal(nodes["health-links"].nodes.length, 30);
  nodes["more-links"].events.click();
  assert.equal(nodes["health-links"].nodes.length, 35);
  nodes["link-filter"].events.change({ target: { value: "broken" } });
  assert.equal(nodes["health-links"].nodes.length, 2);
  assert.match(nodes["health-links"].textContent, /HTTP 404/);
  assert.equal(nodes["more-links"].hidden, true);
});

test("failed health fetch shows an error instead of empty metrics", async () => {
  const nodes = await render(null, true);
  assert.equal(nodes["health-error"].hidden, false);
  assert.equal(nodes["health-content"].hidden, true);
  assert.match(nodes["health-updated"].textContent, /unavailable/);
});
