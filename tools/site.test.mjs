import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../site/app.js", import.meta.url), "utf8");
const installs = fs.readFileSync(new URL("../site/install-core.js", import.meta.url), "utf8");

// A small DOM surface for exercising the rendered text, links and event handlers.
class Node {
  constructor(tagName, text = "") {
    this.tagName = tagName;
    this.nodes = [];
    this.value = text;
    this.attributes = {};
    this.events = {};
  }
  get children() { return this.nodes.filter((node) => node.tagName !== "#text"); }
  get textContent() { return this.value + this.nodes.map((node) => node.textContent).join(""); }
  set textContent(value) { this.value = String(value); this.nodes = []; }
  set innerHTML(value) { throw new Error("HTML rendering is not allowed"); }
  append(...nodes) { this.nodes.push(...nodes); }
  replaceChildren(...nodes) { this.nodes = nodes; this.value = ""; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, callback) { this.events[name] = callback; }
  showModal() { this.open = true; }
  close() { this.open = false; }
}

async function render(apps) {
  const nodes = Object.fromEntries(["results", "count", "empty", "error", "chips", "q", "distro"].map((id) => [id, new Node("div")]));
  const body = new Node("body");
  vm.runInNewContext(installs + "\n" + source, {
    URL,
    document: {
      body,
      createElement: (tag) => new Node(tag),
      createTextNode: (text) => new Node("#text", text),
      getElementById: (id) => nodes[id],
    },
    fetch: async () => ({ ok: true, json: async () => apps }),
  });
  await new Promise(setImmediate);
  nodes.open = () => {
    find(nodes.results, "button")[0].events.click();
    return body.nodes[0];
  };
  return nodes;
}

function find(root, tag) {
  return [...(root.tagName === tag ? [root] : []), ...root.nodes.flatMap((node) => find(node, tag))];
}

function app(overrides = {}) {
  return {
    id: "example", name: "Example", vendor: "Example vendor", category: "other",
    homepage: "https://example.org", aliases: ["Example Suite"], verified: false,
    alternatives: [], wine: { status: "untested", report_count: 0 }, reports: [],
    ...overrides,
  };
}

function report(overrides = {}) {
  return {
    app: "example", app_version: "1.0", runner: { type: "proton", version: "9.0" },
    distro: "Example Linux", status: "gold", reporter: "tester", date: "2026-01-15",
    ...overrides,
  };
}

test("app details expose aliases, official links and an explicit untested state", async () => {
  const results = (await render([app()])).open();
  assert.match(results.textContent, /App details and reports \(0\)/);
  assert.match(results.textContent, /Also known as: Example Suite/);
  assert.match(results.textContent, /No compatibility reports yet. Compatibility is untested./);
  assert.equal(find(results, "a")[0].href, "https://example.org");
});

test("reports show newest first with runner, version, attribution and all adjustments", async () => {
  const results = (await render([app({
    wine: { status: "gold", report_count: 2 },
    reports: [report(), report({
      app_version: "2.0", date: "2026-02-01", runner: { type: "bottles", version: "51" },
      tweaks: { windows_version: "Windows 10", winetricks: ["corefonts"], env: { EXAMPLE: "value" } },
      notes: "Opens files.\nPrinting was not tested.",
    })],
  })])).open();
  assert.deepEqual(find(results, "h4").map((node) => node.textContent), ["Version 2.0", "Version 1.0"]);
  for (const expected of ["Bottles 51", "Proton 9.0", "Example Linux", "Reported by tester", "Result: gold", "Windows version: Windows 10", "Winetricks: corefonts", "EXAMPLE=value", "Opens files.\nPrinting was not tested."]) {
    assert.ok(results.textContent.includes(expected), expected);
  }
  assert.deepEqual(find(results, "time").map((node) => node.dateTime), ["2026-02-01", "2026-01-15"]);
});

test("community text stays literal and unsafe source and homepage links are omitted", async () => {
  const literal = '<img src=x onerror="alert(1)">';
  const results = (await render([app({
    homepage: "javascript:alert(1)",
    wine: { status: "gold", appdb_url: "javascript:alert(1)" },
    reports: [report({ notes: literal, tweaks: { env: { EXAMPLE: literal } } })],
    alternatives: [{
      fit: "partial", notes: literal, sources: ["javascript:alert(1)", "https://example.org/source"],
      alternative: { name: literal, homepage: "javascript:alert(1)", license: "MIT", install: [{ method: "apt", ref: "foo; echo bad" }] },
    }],
  })])).open();
  assert.ok(results.textContent.includes(literal));
  assert.equal(find(results, "img").length, 0);
  assert.deepEqual(find(results, "a").map((node) => node.href), ["https://example.org/source"]);
  assert.equal(find(results, "code").some((node) => node.textContent.startsWith("sudo")), false);
});

test("search keeps app details and reports attached to matching results", async () => {
  const nodes = await render([app(), app({ id: "second", name: "Second", aliases: [] })]);
  nodes.q.events.input({ target: { value: "Example Suite" } });
  assert.equal(nodes.results.children.length, 1);
  assert.match(nodes.results.textContent, /Alternatives & install options/);
  assert.equal(nodes.count.textContent, "1 of 2 apps");
});

test("all installation options are visible and distribution changes keep cross-distribution routes", async () => {
  const nodes = await render([app({ alternatives: [{
    id: "example-alt", fit: "partial", alternative: {
      name: "Example alternative", homepage: "https://example.org", license: "MIT", install: [
        { method: "apt", ref: "example", distros: ["debian"], sources: ["https://example.org/debian"] },
        { method: "dnf", ref: "example-fedora", distros: ["fedora"] },
        { method: "flatpak", ref: "org.example.App", distros: ["any"] },
        { method: "download", ref: "https://example.org/download", distros: ["any"] },
      ],
    },
  }] })]);
  assert.equal(find(nodes.results, "code").length, 0);
  const details = nodes.open();
  assert.equal(details.open, true);
  assert.equal(find(details, "code").length, 3);
  assert.ok(find(details, "a").some((a) => a.href === "https://example.org/download"));
  const select = find(details, "select")[0];
  select.events.change({ target: { value: "fedora" } });
  assert.deepEqual(find(details, "code").map((n) => n.textContent), ["sudo dnf install example-fedora", "flatpak install flathub org.example.App"]);
  assert.equal(nodes.distro.value, "fedora");
  find(details, "button")[0].events.click();
  assert.equal(details.open, false);
});
