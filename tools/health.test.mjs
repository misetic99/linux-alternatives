import test from "node:test";
import assert from "node:assert/strict";
import { inventoryDigest } from "./links.mjs";
import { buildHealth, linkSnapshot } from "./health.mjs";

const now = new Date("2026-11-24T12:00:00Z");
const inventory = [{ url: "https://example.org/", references: [{ file: "apps/example.yaml", field: "homepage" }] }];
const report = (extra = {}) => ({
  report_version: 1, checked_at: now.toISOString(), inventory_digest: inventoryDigest(inventory),
  results: [{ url: inventory[0].url, state: "ok", status: 200 }], ...extra,
});

test("missing, changed, incomplete and future-dated link checks never imply healthy links", () => {
  assert.equal(linkSnapshot(inventory, null, now).state, "missing");
  assert.equal(linkSnapshot(inventory, report({ inventory_digest: "old" }), now).state, "outdated");
  for (const item of [null, false, "invalid"]) {
    assert.equal(linkSnapshot(inventory, report({ results: [item] }), now).state, "invalid");
  }
  for (const saved of [report({ results: [] }), report({ results: [...report().results, ...report().results] }), report({ checked_at: "2027-01-01" }), report({ checked_at: 123 }), report({ results: [{ url: "https://other.org/", state: "ok" }] }), report({ results: [{ url: inventory[0].url, state: "ok", status: 500 }] })]) {
    const snapshot = linkSnapshot(inventory, saved, now);
    assert.equal(snapshot.state, "invalid");
    assert.equal(snapshot.counts, null);
  }
});

test("snapshot counts are recomputed and old checks remain visibly stale", () => {
  const current = linkSnapshot(inventory, report({ counts: { ok: 999 } }), now);
  assert.equal(current.state, "current");
  assert.equal(current.counts.ok, 1);
  assert.equal(linkSnapshot(inventory, report({ checked_at: "2026-11-01T12:00:00Z" }), now).state, "stale");
});

test("health metrics include empty categories and actionable review queues", () => {
  const dataset = {
    apps: [
      { id: "one", name: "One", category: "graphics", verified: true, verified_on: "2026-11-24", alternatives: [{ id: "a", sources: [] }], reports: [{ date: "2025-01-01" }] },
      { id: "two", name: "Two", category: "graphics", verified: false, alternatives: [], reports: [] },
    ],
    alternatives: [{ id: "a", name: "Alternative", install: [{ method: "apt", ref: "a" }] }],
  };
  const health = buildHealth(dataset, ["graphics", "printing", "other"], inventory, { now });
  assert.equal(health.counts.apps, 2);
  assert.equal(health.counts.verified_percent, 50);
  assert.equal(health.counts.reports, 1);
  assert.equal(health.categories.find((row) => row.id === "printing").apps, 0);
  assert.deepEqual(health.review.without_alternatives.map((app) => app.id), ["two"]);
  assert.deepEqual(health.review.without_comparison_sources.map((app) => app.id), ["one"]);
  assert.equal(health.review.incomplete_install_metadata.length, 1);
  assert.equal(health.review.reports_over_one_year_old, 1);
  assert.equal(health.review.verification_dates, "recorded");
  assert.equal(health.review.latest_verification, "2026-11-24");
  assert.deepEqual(health.review.verifications_over_one_year_old, []);
  assert.equal(health.links.counts, null);
});

test("verification age uses UTC dates and the 365-day boundary, ordered oldest first", () => {
  const dataset = {
    apps: [
      ["boundary", "2025-11-24"], ["older-b", "2025-11-23"], ["older-a", "2025-11-23"],
      ["oldest", "2024-02-29"], ["today", "2026-11-24"],
    ].map(([id, verified_on]) => ({ id, name: id, category: "other", verified: true, verified_on, alternatives: [] })),
    alternatives: [],
  };
  for (const time of ["2026-11-24T00:00:00Z", "2026-11-24T23:59:59Z"]) {
    const health = buildHealth(dataset, ["other"], [], { now: new Date(time) });
    assert.deepEqual(health.review.verifications_over_one_year_old.map((app) => [app.id, app.verified_on]), [
      ["oldest", "2024-02-29"], ["older-a", "2025-11-23"], ["older-b", "2025-11-23"],
    ]);
    assert.equal(health.review.latest_verification, "2026-11-24");
    assert.equal(health.counts.verified_apps, 5);
    assert.equal(dataset.apps.every((app) => app.verified), true);
  }
});

test("empty and entirely unverified catalogs have no verification age", () => {
  for (const apps of [[], [{ id: "seed", name: "Seed", category: "other", verified: false, alternatives: [] }]]) {
    const health = buildHealth({ apps, alternatives: [] }, ["other"], [], { now });
    assert.equal(health.review.latest_verification, null);
    assert.deepEqual(health.review.verifications_over_one_year_old, []);
  }
});
