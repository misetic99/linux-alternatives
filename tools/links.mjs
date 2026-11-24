import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";

export const LINK_STATES = ["ok", "redirected", "broken", "blocked", "temporary", "timeout", "unreachable", "invalid", "http_error"];

export function normaliseLink(value) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Only public HTTP(S) URLs without credentials are checked.");
  url.hash = "";
  return url.href;
}

/** Collect structured data URLs once, retaining every file and field that uses them. */
export function collectLinks(entries) {
  const links = new Map();
  for (const { kind, file, data } of entries) {
    const add = (value, field) => {
      if (!value) return;
      let url;
      try { url = normaliseLink(value); } catch { url = String(value); }
      if (!links.has(url)) links.set(url, { url, references: [] });
      links.get(url).references.push({ kind, id: data.id || data.app, file, field });
    };
    if (kind === "app") {
      add(data.homepage, "homepage");
      add(data.wine?.appdb_url, "wine.appdb_url");
      for (const [i, alternative] of data.alternatives.entries()) {
        for (const [j, source] of (alternative.sources || []).entries()) add(source, `alternatives[${i}].sources[${j}]`);
      }
    } else if (kind === "alternative") {
      add(data.homepage, "homepage");
      for (const [i, route] of data.install.entries()) {
        if (["download", "appimage"].includes(route.method)) add(route.ref, `install[${i}].ref`);
        for (const [j, source] of (route.sources || []).entries()) add(source, `install[${i}].sources[${j}]`);
      }
    }
  }
  return [...links.values()].sort((a, b) => a.url.localeCompare(b.url)).map((item) => ({
    ...item, references: item.references.sort((a, b) => `${a.file}:${a.field}`.localeCompare(`${b.file}:${b.field}`)),
  }));
}

export function inventoryDigest(inventory) {
  return createHash("sha256").update(JSON.stringify(inventory)).digest("hex");
}

/** Exclude loopback, private, link-local, multicast and reserved network targets. */
export function isPublicAddress(address) {
  if (address.startsWith("::ffff:")) {
    const suffix = address.slice(7);
    if (isIP(suffix) === 4) return isPublicAddress(suffix);
    return false;
  }
  if (isIP(address) === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && [0, 168].includes(b)) ||
      (a === 198 && ([18, 19].includes(b) || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
  }
  // Public IPv6 unicast allocations are within 2000::/3. Exclude documentation and transition ranges.
  return isIP(address) === 6 && /^[23]/i.test(address) && !/^2001:(?:db8|0|10|20):/i.test(address) && !/^2002:/i.test(address);
}

function targetUrl(value, allowPrivate) {
  const url = new URL(normaliseLink(value));
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!allowPrivate && (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || (isIP(host) && !isPublicAddress(host)))) {
    throw Object.assign(new Error("Non-public network targets are not requested."), { code: "UNSAFE_TARGET" });
  }
  return url;
}

/** Read headers and at most 8 KiB of a GET response. DNS results are checked before connecting. */
export function requestUrl(value, { method, timeoutMs, allowPrivate = false }) {
  return new Promise((resolve, reject) => {
    let url;
    try { url = targetUrl(value, allowPrivate); } catch (error) { reject(error); return; }
    const safeLookup = async (hostname, options, callback) => {
      try {
        let addresses = await lookup(hostname, { all: true });
        if (!allowPrivate) addresses = addresses.filter((item) => isPublicAddress(item.address));
        if (options.family) addresses = addresses.filter((item) => item.family === options.family);
        if (!addresses.length) throw Object.assign(new Error("No public address is available for this host."), { code: "UNSAFE_TARGET" });
        if (options.all) callback(null, addresses);
        else callback(null, addresses[0].address, addresses[0].family);
      } catch (error) { callback(error); }
    };
    const transport = url.protocol === "https:" ? https : http;
    let timer;
    const finish = (value) => { clearTimeout(timer); resolve(value); };
    const fail = (error) => { clearTimeout(timer); reject(error); };
    const req = transport.request(url, {
      method, agent: false, lookup: safeLookup,
      headers: { "User-Agent": "linux-alternatives link checker", Accept: "*/*", "Accept-Encoding": "identity", ...(method === "GET" ? { Range: "bytes=0-8191" } : {}) },
    }, (res) => {
      const result = { status: res.statusCode, headers: res.headers, body: "" };
      res.on("error", fail);
      if (method === "HEAD") { res.resume(); finish(result); return; }
      const chunks = [];
      let size = 0;
      res.on("data", (chunk) => {
        chunks.push(chunk.subarray(0, Math.max(0, 8192 - size)));
        size += chunk.length;
        if (size >= 8192) {
          result.body = Buffer.concat(chunks).toString("utf8");
          finish(result);
          res.destroy();
        }
      });
      res.on("end", () => { result.body = Buffer.concat(chunks).toString("utf8"); finish(result); });
    });
    req.on("error", fail);
    timer = setTimeout(() => req.destroy(Object.assign(new Error("Request timed out."), { code: "LINK_TIMEOUT" })), timeoutMs);
    req.end();
  });
}

function classify(response, originalUrl) {
  const { status, body = "", url } = response;
  if ([401, 403, 407, 451].includes(status) || /<title[^>]*>\s*(?:just a moment|access denied|oh noes!|making sure you|attention required)/i.test(body)) return "blocked";
  if (status === 429 || status >= 500) return "temporary";
  if ([404, 410].includes(status)) return "broken";
  if (status >= 200 && status < 300) return url === originalUrl ? "ok" : "redirected";
  return "http_error";
}

/** HEAD first, GET fallback, manual redirects, bounded retries. A blocked request is never called broken. */
export async function probeLink(value, { request = requestUrl, timeoutMs = 8000, retries = 1, delay = sleep, allowPrivate = false } = {}) {
  let originalUrl;
  try { originalUrl = normaliseLink(value); } catch { return { url: value, state: "invalid", detail: "Invalid HTTP(S) URL or embedded credentials." }; }
  const follow = async (method) => {
    let url = originalUrl;
    const seen = new Set();
    for (let i = 0; i <= 5; i += 1) {
      targetUrl(url, allowPrivate);
      if (seen.has(url)) throw new Error("Redirect loop.");
      seen.add(url);
      const response = await request(url, { method, timeoutMs, allowPrivate });
      if ([301, 302, 303, 307, 308].includes(response.status) && response.headers.location) {
        url = normaliseLink(new URL(response.headers.location, url).href);
        continue;
      }
      return { ...response, url };
    }
    throw new Error("Redirect limit reached.");
  };
  let result;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let retryAfter;
    try {
      let response = await follow("HEAD");
      const type = String(response.headers["content-type"] || "");
      if ([400, 403, 404, 405, 410, 501].includes(response.status) || (response.status >= 200 && response.status < 300 && (!type || type.includes("html")))) response = await follow("GET");
      const state = classify(response, originalUrl);
      result = { url: originalUrl, state, status: response.status, final_url: response.url, attempts: attempt + 1 };
      const raw = response.headers["retry-after"];
      if (raw) retryAfter = /^\d+$/.test(raw) ? Number(raw) * 1000 : Math.max(0, Date.parse(raw) - Date.now());
      if (Number.isFinite(retryAfter)) result.retry_after_ms = retryAfter;
    } catch (error) {
      const state = error.code === "UNSAFE_TARGET" ? "blocked" : error.code === "LINK_TIMEOUT" ? "timeout" : "unreachable";
      result = { url: originalUrl, state, detail: String(error.code || error.message).slice(0, 160), attempts: attempt + 1 };
    }
    if (!["temporary", "timeout", "unreachable"].includes(result.state) || attempt === retries || retryAfter > 2000) break;
    await delay(Number.isFinite(retryAfter) ? retryAfter : 500 * (attempt + 1));
  }
  return result;
}

export async function checkLinks(inventory, { concurrency = 6, probe = probeLink, onProgress = () => {}, ...options } = {}) {
  const groups = new Map();
  for (const item of inventory) {
    let host;
    try { host = new URL(item.url).origin; } catch { host = item.url; }
    if (!groups.has(host)) groups.set(host, { items: [], busy: false });
    groups.get(host).items.push(item);
  }
  const queues = [...groups.values()];
  const results = [];
  let active = 0;
  let cursor = 0;
  await new Promise((resolve, reject) => {
    const dispatch = () => {
      for (let visited = 0; visited < queues.length; visited += 1) {
        if (active >= concurrency) break;
        const group = queues[cursor++ % queues.length];
        if (group.busy || !group.items.length) continue;
        const item = group.items.shift();
        group.busy = true;
        active += 1;
        Promise.resolve().then(() => probe(item.url, options)).then((result) => {
          results.push({ ...result, references: item.references });
          onProgress(result, results.length, inventory.length);
          if (result.status === 429) {
            for (const skipped of group.items.splice(0)) {
              const deferred = { url: skipped.url, state: "temporary", detail: "Origin rate-limited; this URL was not requested.", attempts: 0, references: skipped.references };
              results.push(deferred);
              onProgress(deferred, results.length, inventory.length);
            }
          }
        }).then(() => sleep(100)).then(() => {
          group.busy = false;
          active -= 1;
          dispatch();
        }).catch(reject);
      }
      if (active === 0 && queues.every((group) => !group.items.length)) resolve();
    };
    dispatch();
  });
  const counts = Object.fromEntries(LINK_STATES.map((state) => [state, results.filter((item) => item.state === state).length]));
  return {
    report_version: 1, checked_at: new Date().toISOString(), inventory_digest: inventoryDigest(inventory), total: inventory.length,
    counts, results: results.sort((a, b) => a.url.localeCompare(b.url)),
  };
}

export function reportMarkdown(report) {
  const plain = (value) => String(value).replace(/[\r\n|`<>]/g, " ");
  const lines = ["# Link check", "", `Checked: ${report.checked_at}`, "", `Unique URLs: ${report.total}`, "", "| Result | Count |", "| --- | ---: |"];
  for (const state of LINK_STATES) lines.push(`| ${state} | ${report.counts[state]} |`);
  lines.push("", "## URLs needing review", "", "Blocked, temporary and unreachable URLs are not confirmed dead links. HTTP availability does not verify application or package claims. URL fragments are not checked.", "");
  for (const result of report.results.filter((item) => !["ok", "redirected"].includes(item.state))) {
    lines.push(`- ${plain(result.state)}${result.status ? ` (HTTP ${result.status})` : ""}: ${plain(result.url)}`);
    for (const ref of result.references) lines.push(`  - ${plain(ref.file)}: ${plain(ref.field)}`);
  }
  return lines.join("\n") + "\n";
}
