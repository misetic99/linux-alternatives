import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../site/plan-core.js", import.meta.url), "utf8");
const context = {};
vm.runInNewContext(fs.readFileSync(new URL("../site/install-core.js", import.meta.url), "utf8"), context);
vm.runInNewContext(source, context);
const { buildPlan, buildScript, parseHash, toHash, clean } = context.PlanCore;

// Objects created inside the vm context have a different Object.prototype.
const plain = (value) => JSON.parse(JSON.stringify(value));

const alt = (name, install = [{ method: "flatpak", ref: "org.example.App" }]) => ({ name, install });
const app = (id, links, extra = {}) => ({ id, name: id.toUpperCase(), verified: false, alternatives: links, ...extra });

test("best fit is the primary alternative; others are listed after it", () => {
  const plan = buildPlan([
    app("cad", [
      { id: "a", fit: "minimal", alternative: alt("Weak") },
      { id: "b", fit: "good", alternative: alt("Strong") },
    ]),
  ], ["cad"]);
  assert.equal(plan.items[0].primary.alternative.name, "Strong");
  assert.equal(plan.items[0].others.length, 1);
});

test("counts, coverage and unverified entries are summarised", () => {
  const plan = buildPlan([
    app("one", [{ id: "a", fit: "full", alternative: alt("A") }], { verified: true }),
    app("two", [{ id: "b", fit: "partial", alternative: alt("B") }]),
    app("three", []),
  ], ["one", "two", "three", "missing-id"]);
  assert.equal(plan.total, 3);
  assert.equal(plan.covered, 2);
  assert.deepEqual(plain(plan.counts), { full: 1, good: 0, partial: 1, minimal: 0, none: 1 });
  assert.equal(plan.unverified, 2);
});

test("script installs each Flatpak once and marks apps without alternatives", () => {
  const shared = alt("Shared", [{ method: "flatpak", ref: "org.shared.App" }]);
  const plan = buildPlan([
    app("one", [{ id: "s", fit: "good", alternative: shared }]),
    app("two", [{ id: "s", fit: "good", alternative: shared }]),
    app("three", []),
  ], ["one", "two", "three"]);
  const script = buildScript(plan);
  assert.equal(script.split("flatpak install -y flathub org.shared.App").length - 1, 1);
  assert.match(script, /# THREE: no known alternative yet/);
  assert.match(script, /^#!\/usr\/bin\/env bash/);
});

test("names cannot break out of a comment into a command", () => {
  const evil = "Nice\nrm -rf ~\r\n$(reboot)";
  const plan = buildPlan([
    { id: "x", name: evil, verified: false, alternatives: [{ id: "a", fit: "good", alternative: alt(evil) }] },
  ], ["x"]);
  const lines = buildScript(plan).split("\n");
  assert.equal(lines.some((l) => l.startsWith("rm ")), false);
  assert.equal(lines.some((l) => l.includes("\r")), false);
  for (const line of lines) {
    if (line.includes("rm -rf") || line.includes("reboot")) assert.ok(line.startsWith("#"), line);
  }
  assert.equal(clean(evil).includes("\n"), false);
});

test("unsafe package refs never reach the script", () => {
  const plan = buildPlan([
    app("x", [{ id: "a", fit: "good", alternative: alt("Bad", [
      { method: "flatpak", ref: "org.ok.App; rm -rf ~" },
      { method: "apt", ref: "pkg && reboot" },
    ]) }]),
  ], ["x"]);
  const script = buildScript(plan);
  assert.equal(script.includes("rm -rf ~\n"), false);
  assert.equal(/^flatpak install/m.test(script), false);
  assert.equal(script.includes("apt install"), false);
  assert.match(script, /no safe install command listed/);
});

test("non-Flatpak alternatives are only suggested as comments", () => {
  const plan = buildPlan([app("x", [{ id: "a", fit: "good", alternative: alt("Apt only", [{ method: "apt", ref: "foo" }]) }])], ["x"]);
  const script = buildScript(plan);
  assert.match(script, /^# no Flatpak listed; alternative install: sudo apt install foo$/m);
  assert.equal(/^sudo/m.test(script), false);
});

test("hash parsing keeps only known ids and round-trips", () => {
  const known = ["autocad", "winrar"];
  assert.deepEqual(plain(parseHash("#apps=winrar,evil,autocad,winrar", known)), ["winrar", "autocad"]);
  assert.deepEqual(plain(parseHash("", known)), []);
  assert.deepEqual(plain(parseHash("#other=1", known)), []);
  assert.equal(toHash(["winrar", "autocad"]), "#apps=autocad,winrar");
  assert.equal(toHash([]), "");
});
