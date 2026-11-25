import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateData, buildDist, summariseReports, loadData, REPO_ROOT } from "./lib.mjs";

function makeData(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "la-test-"));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return dir;
}

const ALT = `id: foo
name: Foo
homepage: https://example.org
license: MIT
install:
  - method: apt
    ref: foo
`;
const APP = `id: bar
name: Bar
vendor: Acme
category: other
alternatives:
  - id: foo
    fit: good
`;
const REPORT = (extra = {}) =>
  Object.entries({
    app: "bar",
    app_version: '"1.0"',
    distro: "Debian 12",
    status: "gold",
    reporter: "someone",
    date: "2026-01-15",
    ...extra,
  })
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n") + "\nrunner:\n  type: wine\n  version: \"9.0\"\n";

test("the real data directory is valid", () => {
  assert.deepEqual(validateData(path.join(REPO_ROOT, "data")), []);
});

test("minimal valid dataset passes", () => {
  const dir = makeData({
    "alternatives/foo.yaml": ALT,
    "apps/bar.yaml": APP,
    "reports/bar/r1.yaml": REPORT(),
  });
  assert.deepEqual(validateData(dir), []);
});

test("template files starting with _ are ignored", () => {
  const dir = makeData({ "apps/_template.yaml": "not: [valid" });
  assert.deepEqual(validateData(dir), []);
});

test("id must match the file name", () => {
  const dir = makeData({ "alternatives/foo.yaml": ALT, "apps/other.yaml": APP });
  const errors = validateData(dir);
  assert.ok(errors.some((e) => e.includes("must equal the file name")), errors.join("\n"));
});

test("unknown alternative is rejected", () => {
  const dir = makeData({ "apps/bar.yaml": APP });
  const errors = validateData(dir);
  assert.ok(errors.some((e) => e.includes('alternative "foo" does not exist')), errors.join("\n"));
});

test("unknown properties are rejected", () => {
  const dir = makeData({ "alternatives/foo.yaml": ALT, "apps/bar.yaml": APP + "colour: red\n" });
  const errors = validateData(dir);
  assert.ok(errors.some((e) => e.includes("colour")), errors.join("\n"));
});

test("invalid enum value is rejected", () => {
  const dir = makeData({
    "alternatives/foo.yaml": ALT,
    "apps/bar.yaml": APP.replace("fit: good", "fit: amazing"),
  });
  assert.ok(validateData(dir).length > 0);
});

test("report must live in the folder of its app", () => {
  const dir = makeData({
    "alternatives/foo.yaml": ALT,
    "apps/bar.yaml": APP,
    "reports/wrong/r1.yaml": REPORT(),
  });
  const errors = validateData(dir);
  assert.ok(errors.some((e) => e.includes("must live in data/reports/bar/")), errors.join("\n"));
});

test("report for a missing app is rejected", () => {
  const dir = makeData({ "reports/bar/r1.yaml": REPORT() });
  const errors = validateData(dir);
  assert.ok(errors.some((e) => e.includes('app "bar" does not exist')), errors.join("\n"));
});

test("bad dates are rejected", () => {
  const dir = makeData({
    "alternatives/foo.yaml": ALT,
    "apps/bar.yaml": APP,
    "reports/bar/r1.yaml": REPORT({ date: "yesterday" }),
  });
  assert.ok(validateData(dir).length > 0);
});

test("verification requires a complete review date and never accepts a date on an unverified entry", () => {
  const now = new Date("2026-11-25T00:01:00Z");
  const errorsFor = (fields) => validateData(makeData({
    "alternatives/foo.yaml": ALT,
    "apps/bar.yaml": APP + fields,
  }), { now });
  for (const fields of ["", "verified: false\n", "verified: true\nverified_on: 2026-11-25\n", "verified: true\nverified_on: 2024-02-29\n"]) {
    assert.deepEqual(errorsFor(fields), [], fields);
  }
  for (const fields of [
    "verified: true\n",
    "verified_on: 2026-11-25\n",
    "verified: false\nverified_on: 2026-11-25\n",
    ...["yesterday", "2026-02-29", "2026-13-01", "2026-11-25T00:00:00Z", "2026-1-1"].map((date) => `verified: true\nverified_on: '${date}'\n`),
  ]) {
    assert.ok(errorsFor(fields).length > 0, fields);
  }
  assert.ok(errorsFor("verified: true\nverified_on: 2026-11-26\n").some((error) => error.includes("must not be in the future (UTC)")));
});

test("full API documents preserve the independent review date without dating unverified entries", () => {
  const dataset = (fields) => makeData({ "alternatives/foo.yaml": ALT, "apps/bar.yaml": APP + fields });
  assert.equal(buildDist(dataset("verified: true\nverified_on: 2024-02-29\n")).apps[0].verified_on, "2024-02-29");
  assert.equal(Object.hasOwn(buildDist(dataset("verified: false\n")).apps[0], "verified_on"), false);
});

test("invalid YAML and bad file names are reported, not thrown", () => {
  const dir = makeData({ "apps/broken.yaml": "a: [", "apps/Bad Name.yaml": "x: 1" });
  const errors = validateData(dir);
  assert.ok(errors.some((e) => e.includes("invalid YAML")));
  assert.ok(errors.some((e) => e.includes("file name must be lowercase")));
});

test("install refs cannot smuggle shell characters", () => {
  const bad = ALT.replace("ref: foo", 'ref: "foo; rm -rf ~"');
  const dir = makeData({ "alternatives/foo.yaml": bad });
  assert.ok(validateData(dir).length > 0);
});

test("download refs must be http(s) URLs", () => {
  const url = ALT.replace("method: apt", "method: download").replace("ref: foo", "ref: https://example.org/foo.AppImage");
  assert.deepEqual(validateData(makeData({ "alternatives/foo.yaml": url })), []);
  const nonUrl = ALT.replace("method: apt", "method: download");
  assert.ok(validateData(makeData({ "alternatives/foo.yaml": nonUrl })).length > 0);
});

test("summariseReports: no reports means untested", () => {
  assert.deepEqual(summariseReports([]), { status: "untested", report_count: 0 });
});

test("summariseReports: most common wins, ties go to the newest", () => {
  const r = (status, date) => ({ status, date });
  assert.equal(summariseReports([r("gold", "2026-01-01"), r("gold", "2026-01-02"), r("borked", "2026-02-01")]).status, "gold");
  assert.equal(summariseReports([r("gold", "2026-01-01"), r("borked", "2026-02-01")]).status, "borked");
});

test("buildDist resolves alternatives and derives wine status", () => {
  const dir = makeData({
    "alternatives/foo.yaml": ALT,
    "apps/bar.yaml": APP,
    "reports/bar/r1.yaml": REPORT({ status: "silver" }),
  });
  const { apps, index } = buildDist(dir);
  assert.equal(apps[0].alternatives[0].alternative.name, "Foo");
  assert.equal(apps[0].wine.status, "silver");
  assert.equal(apps[0].verified, false);
  assert.equal(index[0].wine_status, "silver");
});

test("buildDist refuses invalid data", () => {
  const dir = makeData({ "apps/bar.yaml": APP });
  assert.throws(() => buildDist(dir), /invalid/);
});

test("catalog installation routes carry distribution scope and source links", () => {
  const { entries } = loadData(path.join(REPO_ROOT, "data"));
  for (const { kind, data } of entries) {
    if (kind !== "alternative") continue;
    for (const route of data.install) {
      assert.ok(route.distros?.length, `${data.id}: missing distribution scope`);
      assert.ok(route.sources?.length, `${data.id}: missing installation sources`);
      assert.ok(route.notes, `${data.id}: missing installation requirements`);
    }
  }
});

test("new installation metadata rejects unknown distributions and unsafe Portage atoms", () => {
  for (const entry of [
    { method: "apt", ref: "foo", distros: ["any"] },
    { method: "apt", ref: "foo", classic: true },
    { method: "apt", ref: "foo", distros: ["unknown-distro"] },
    { method: "emerge", ref: "category/foo;reboot", distros: ["gentoo"] },
    { method: "download", ref: "javascript:alert(1)" },
  ]) {
    const content = `id: foo\nname: Foo\nhomepage: https://example.org\nlicense: MIT\ninstall: ${JSON.stringify([entry])}\n`;
    assert.ok(validateData(makeData({ "alternatives/foo.yaml": content })).length > 0, JSON.stringify(entry));
  }
  for (const entry of [
    { method: "emerge", ref: "media-gfx/foo", distros: ["gentoo"] },
    { method: "snap", ref: "foo", classic: true },
    { method: "appimage", ref: "https://example.org/Foo.AppImage", distros: ["any"] },
  ]) {
    const content = `id: foo\nname: Foo\nhomepage: https://example.org\nlicense: MIT\ninstall: ${JSON.stringify([entry])}\n`;
    assert.deepEqual(validateData(makeData({ "alternatives/foo.yaml": content })), [], JSON.stringify(entry));
  }
});
