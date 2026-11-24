import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = { URL };
vm.runInNewContext(fs.readFileSync(new URL("../site/install-core.js", import.meta.url), "utf8"), context);
const { command, validRoute, matches, DISTROS, METHODS } = context.InstallCore;

test("installation method and distribution vocabularies match the schema", () => {
  const schema = JSON.parse(fs.readFileSync(new URL("../schema/alternative.schema.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(METHODS).sort(), schema.properties.install.items.properties.method.enum.sort());
  assert.deepEqual(Object.keys(DISTROS).sort(), schema.$defs.distro.enum.sort());
});

test("native package managers use fixed templates and manager-specific safe references", () => {
  assert.equal(command({ method: "zypper", ref: "gimp" }), "sudo zypper install gimp");
  assert.equal(command({ method: "emerge", ref: "media-gfx/gimp" }), "sudo emerge --ask media-gfx/gimp");
  assert.equal(command({ method: "nix", ref: "gimp" }), "nix profile install nixpkgs#gimp");
  assert.equal(command({ method: "snap", ref: "blender", classic: true }), "sudo snap install blender --classic");
  for (const method of Object.keys(METHODS)) {
    for (const ref of ["-y", "pkg;reboot", "$(reboot)", "foo\nreboot", "foo bar", "a/../../b"]) {
      assert.equal(command({ method, ref }), null, `${method}: ${ref}`);
    }
  }
  assert.equal(command({ method: "constructor", ref: "foo" }), null);
  assert.equal(command({ method: "apt", ref: "category/foo" }), null);
});

test("downloads are links, never executable shell snippets", () => {
  for (const method of ["download", "appimage"]) {
    assert.equal(validRoute({ method, ref: "https://example.org/file.AppImage" }), true);
    assert.equal(command({ method, ref: "https://example.org/file.AppImage" }), null);
    assert.equal(validRoute({ method, ref: "javascript:alert(1)" }), false);
    assert.equal(validRoute({ method, ref: "https://example.org/file\nreboot" }), false);
  }
});

test("distribution filtering does not infer native package availability for derivatives", () => {
  assert.equal(matches({ distros: ["debian"] }, "ubuntu"), false);
  assert.equal(matches({ distros: ["fedora"] }, "rhel"), false);
  assert.equal(matches({ distros: ["any"] }, "ubuntu"), true);
  assert.equal(matches({ distros: ["live"] }, "ubuntu"), false);
  assert.equal(matches({}, "ubuntu"), false);
});
