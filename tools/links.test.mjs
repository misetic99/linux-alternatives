import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { collectLinks, inventoryDigest, normaliseLink, probeLink, requestUrl, isPublicAddress, checkLinks, reportMarkdown } from "./links.mjs";

const response = (status, headers = {}, body = "") => ({ status, headers: { "content-type": "application/json", ...headers }, body });

test("URL inventory deduplicates fragments and retains all source fields and query strings", () => {
  const entries = [
    { kind: "app", file: "apps/foo.yaml", data: { id: "foo", homepage: "https://example.org/#intro", alternatives: [{ sources: ["https://example.org/", "https://example.org/?v=2"] }] } },
    { kind: "alternative", file: "alternatives/bar.yaml", data: { id: "bar", homepage: "https://example.org/", install: [{ method: "download", ref: "https://example.org/file", sources: ["https://example.org/"] }] } },
  ];
  const inventory = collectLinks(entries);
  assert.equal(inventory.length, 3);
  assert.equal(inventory.find((item) => item.url === "https://example.org/").references.length, 4);
  assert.equal(inventoryDigest(inventory), inventoryDigest(collectLinks([...entries].reverse())));
  assert.throws(() => normaliseLink("https://user:password@example.org/"));
});

test("HEAD method errors and apparent dead links are confirmed with GET", async () => {
  for (const headStatus of [403, 404, 405, 410, 501]) {
    const calls = [];
    const result = await probeLink("https://example.org/", { request: async (_, { method }) => {
      calls.push(method);
      return response(method === "HEAD" ? headStatus : 200);
    } });
    assert.equal(result.state, "ok");
    assert.deepEqual(calls, ["HEAD", "GET"]);
  }
  assert.equal((await probeLink("https://example.org/", { request: async () => response(404) })).state, "broken");
  assert.equal((await probeLink("https://example.org/", { request: async () => response(410) })).state, "broken");
});

test("HTML challenge pages and denied requests are blocked rather than broken", async () => {
  assert.equal((await probeLink("https://example.org/", { request: async () => response(403) })).state, "blocked");
  const result = await probeLink("https://example.org/", { request: async () => response(200, { "content-type": "text/html" }, "<title>Just a moment...</title>") });
  assert.equal(result.state, "blocked");
  assert.equal(result.status, 200);
});

test("temporary failures retry within limits and long Retry-After values are respected", async () => {
  let calls = 0;
  const result = await probeLink("https://example.org/", { delay: async () => {}, request: async () => response(++calls === 1 ? 503 : 200) });
  assert.equal(result.state, "ok");
  assert.equal(result.attempts, 2);
  calls = 0;
  const limited = await probeLink("https://example.org/", { request: async () => { calls += 1; return response(429, { "retry-after": "3600" }); } });
  assert.equal(limited.state, "temporary");
  assert.equal(calls, 1);
});

test("network failures and timeouts remain distinct from HTTP dead links", async () => {
  for (const [code, state] of [["LINK_TIMEOUT", "timeout"], ["ENOTFOUND", "unreachable"]]) {
    const result = await probeLink("https://example.org/", { retries: 0, request: async () => { throw Object.assign(new Error(code), { code }); } });
    assert.equal(result.state, state);
  }
});

test("redirects are followed manually and non-public targets are never requested", async () => {
  const calls = [];
  const result = await probeLink("https://example.org/", { request: async (url) => {
    calls.push(url);
    return url.endsWith("/new") ? response(200) : response(301, { location: "/new" });
  } });
  assert.equal(result.state, "redirected");
  assert.equal(result.final_url, "https://example.org/new");
  assert.equal(calls.length, 2);
  const blockedCalls = [];
  const blocked = await probeLink("https://example.org/", { request: async (url) => { blockedCalls.push(url); return response(302, { location: "http://127.0.0.1/private" }); } });
  assert.equal(blocked.state, "blocked");
  assert.deepEqual(blockedCalls, ["https://example.org/"]);
  for (const value of ["http://localhost/", "http://169.254.169.254/latest", "http://[::1]/", "http://2130706433/"]) {
    assert.equal((await probeLink(value, { request: async () => { assert.fail("Private target was requested"); } })).state, "blocked");
  }
});

test("public address filtering covers IPv4, mapped addresses and IPv6", () => {
  for (const address of ["127.0.0.1", "10.1.2.3", "172.20.1.1", "192.168.1.1", "169.254.0.1", "100.64.0.1", "203.0.113.1", "::1", "fe80::1", "fc00::1", "::ffff:127.0.0.1", "2001:db8::1"]) assert.equal(isPublicAddress(address), false, address);
  for (const address of ["8.8.8.8", "1.1.1.1", "203.0.114.1", "2001:4860:4860::8888"]) assert.equal(isPublicAddress(address), true, address);
});

test("native HTTP transport handles GET fallback, bounded bodies and request timeouts", async (t) => {
  const server = http.createServer((req, res) => {
    if (req.url === "/slow") { setTimeout(() => res.end("late"), 100).unref(); return; }
    if (req.method === "HEAD") { res.writeHead(405).end(); return; }
    res.writeHead(200, { "content-type": "text/html" });
    res.end("x".repeat(20000));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const result = await probeLink(url, { allowPrivate: true, retries: 0 });
  assert.equal(result.state, "ok");
  const body = await requestUrl(url, { method: "GET", timeoutMs: 1000, allowPrivate: true });
  assert.equal(Buffer.byteLength(body.body), 8192);
  assert.equal((await probeLink(url + "/slow", { allowPrivate: true, retries: 0, timeoutMs: 15 })).state, "timeout");
});

test("scheduler limits requests per origin and defers the rest of a rate-limited origin", async () => {
  const active = new Map();
  let peak = 0;
  let count = 0;
  const inventory = ["https://a.example/1", "https://a.example/2", "https://b.example/1"].map((url) => ({ url, references: [] }));
  await checkLinks(inventory, { concurrency: 2, probe: async (url) => {
    const origin = new URL(url).origin;
    assert.equal(active.get(origin) || 0, 0);
    active.set(origin, 1);
    peak = Math.max(peak, ++count);
    await new Promise(setImmediate);
    count -= 1;
    active.set(origin, 0);
    return { url, state: "ok", status: 200 };
  } });
  assert.equal(peak, 2);
  const called = [];
  const report = await checkLinks(inventory, { probe: async (url) => { called.push(url); return { url, state: "temporary", status: 429 }; } });
  assert.equal(called.length, 2);
  assert.equal(report.results.length, 3);
  assert.equal(report.results.find((item) => item.url.endsWith("a.example/2")).attempts, 0);
  assert.equal(report.counts.temporary, 3);
  assert.match(reportMarkdown(report), /not confirmed dead links/);
});
