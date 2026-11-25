import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parse } from "yaml";
import { validateData } from "./lib.mjs";
import { draftReport, parseIssueForm, parseRunner, parseTweaks, matchApp } from "./report-issue.mjs";

const apps = [
  { id: "autocad", name: "AutoCAD", aliases: [] },
  { id: "microsoft-office", name: "Microsoft Office", aliases: ["Office", "Word"] },
  { id: "microsoft-office-pro", name: "Microsoft Office Pro", aliases: [] },
];

const issue = (overrides = {}) => {
  const f = {
    "App and version": "AutoCAD 2024",
    "Runner and version": "Wine 9.0",
    "Linux distribution": "Fedora 41",
    Result: "gold (perfect after tweaks)",
    "Tweaks needed": "winetricks: corefonts vcrun2019\nWINEDLLOVERRIDES=mscoree=d\nWindows 10",
    Notes: "Opens DWG files.",
    ...overrides,
  };
  return Object.entries(f).map(([k, v]) => `### ${k}\n\n${v}`).join("\n\n");
};
const opts = { reporter: "someone", date: "2026-11-25" };

test("form sections are parsed and empty answers become empty strings", () => {
  const fields = parseIssueForm(issue({ Notes: "_No response_" }));
  assert.equal(fields["App and version"], "AutoCAD 2024");
  assert.equal(fields.Notes, "");
});

test("a complete issue becomes a valid structured draft", () => {
  const r = draftReport(issue(), apps, opts);
  assert.deepEqual(r.errors, []);
  assert.equal(r.report.app, "autocad");
  assert.equal(r.report.app_version, "2024");
  assert.deepEqual({ ...r.report.runner }, { type: "wine", version: "9.0" });
  assert.equal(r.report.status, "gold");
  assert.deepEqual([...r.report.tweaks.winetricks], ["corefonts", "vcrun2019"]);
  assert.equal(r.report.tweaks.env.WINEDLLOVERRIDES, "mscoree=d");
  assert.equal(r.report.tweaks.windows_version, "10");
  assert.match(r.path, /^data\/reports\/autocad\/2026-11-25-wine-9-0-fedora-41-someone\.yaml$/);
});

test("the draft passes the real catalog validator", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "la-report-"));
  const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  put("alternatives/foo.yaml", "id: foo\nname: Foo\nhomepage: https://example.org\nlicense: MIT\ninstall:\n  - method: flatpak\n    ref: org.example.Foo\n");
  put("apps/autocad.yaml", "id: autocad\nname: AutoCAD\nvendor: Acme\ncategory: cad\nalternatives:\n  - id: foo\n    fit: good\n");
  const r = draftReport(issue(), apps, opts);
  put(r.path.replace(/^data\//, ""), r.yaml);
  assert.deepEqual(validateData(dir), []);
});

test("issue text cannot inject YAML keys or override the reporter", () => {
  const evil = 'Looks fine\nstatus: borked\nreporter: admin\n"x": [';
  const r = draftReport(issue({ Notes: evil, "Linux distribution": "Arch\nstatus: borked" }), apps, opts);
  assert.deepEqual(r.errors, []);
  const parsed = parse(r.yaml);
  assert.equal(parsed.status, "gold");
  assert.equal(parsed.reporter, "someone");
  assert.equal(parsed.date, "2026-11-25");
  assert.ok(parsed.notes.includes("status: borked"));
  assert.ok(!parsed.distro.includes("\n"));
  assert.deepEqual(Object.keys(parsed).sort(), ["app", "app_version", "date", "distro", "notes", "reporter", "runner", "status", "tweaks"].sort());
});

test("longest app name wins and the rest is the version", () => {
  assert.equal(matchApp("Microsoft Office Pro 2021", apps).app.id, "microsoft-office-pro");
  assert.equal(matchApp("Microsoft Office 2021", apps).version, "2021");
  assert.equal(matchApp("Word 365", apps).app.id, "microsoft-office");
  assert.ok(matchApp("Photoshop 2024", apps).error);
  assert.ok(matchApp("AutoCADX 1", apps).error);
});

test("runner types are recognised", () => {
  assert.deepEqual({ ...parseRunner("Proton-GE 9-20") }, { type: "proton", version: "GE 9-20" });
  assert.deepEqual({ ...parseRunner("Bottles 51") }, { type: "bottles", version: "51" });
  assert.equal(parseRunner("VirtualBox 7.0").type, "vm");
  const other = parseRunner("Lutris 0.5");
  assert.equal(other.type, "other");
  assert.equal(other.guessed, true);
});

test("unrecognised tweak lines are kept as notes, not dropped or trusted", () => {
  const { tweaks, rest } = parseTweaks("winetricks: dotnet48 rm -rf /\nset the compat mode to Win7\nbad env=1");
  assert.deepEqual([...tweaks.winetricks], ["dotnet48", "rm"]);          // "-rf" and "/" are not verbs
  assert.ok(rest.some((l) => l.includes("rm -rf /")));                    // the whole line is kept for the maintainer
  assert.ok(rest.some((l) => l.includes("compat mode")));
  const r = draftReport(issue({ "Tweaks needed": "set the compat mode to Win7" }), apps, opts);
  assert.match(r.report.notes, /Reported adjustments \(not structured\): set the compat mode to Win7/);
});

test("missing or invalid inputs produce clear errors and no draft", () => {
  assert.ok(draftReport("hello", apps, opts).errors.length > 0);
  assert.ok(draftReport(issue({ Result: "great" }), apps, opts).errors.some((e) => /result/i.test(e)));
  assert.ok(draftReport(issue({ "App and version": "AutoCAD" }), apps, opts).errors.some((e) => /version is missing/.test(e)));
  assert.ok(draftReport(issue({ "Runner and version": "Wine" }), apps, opts).errors.some((e) => /runner version/.test(e)));
  assert.ok(draftReport(issue(), apps, { date: "2026-11-25" }).errors.some((e) => /reporter/.test(e)));
  assert.ok(draftReport(issue(), apps, { reporter: "a b", date: "2026-11-25" }).errors.length > 0);
  assert.ok(draftReport(issue(), apps, { reporter: "ok", date: "2026-02-30" }).errors.some((e) => /date/.test(e)));
  assert.ok(draftReport(issue({ Notes: "x".repeat(1200) }), apps, opts).errors.some((e) => /limit/.test(e)));
  const none = draftReport(issue({ "App and version": "Photoshop 2024" }), apps, opts);
  assert.equal(none.yaml, undefined);
});
