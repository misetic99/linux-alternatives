#!/usr/bin/env node
// Build dist/ (JSON API) from data/. dist/ is generated and never committed.
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT, buildDist } from "./lib.mjs";
import { normaliseSiteUrl, renderPage, sitemap, robots } from "./site-build.mjs";

const dataDir = path.join(REPO_ROOT, "data");
const outDir = path.join(REPO_ROOT, "dist", "api", "v1");

let result;
try {
  result = buildDist(dataDir);
} catch (e) {
  console.error(`✖ ${e.message}`);
  for (const msg of e.validationErrors ?? []) console.error(`  - ${msg}`);
  process.exit(1);
}

fs.rmSync(path.join(REPO_ROOT, "dist"), { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, "apps"), { recursive: true });

const write = (file, value) =>
  fs.writeFileSync(path.join(outDir, file), JSON.stringify(value, null, 2) + "\n");

write("index.json", result.index);
write("apps.json", result.apps);
write("alternatives.json", result.alternatives);
for (const app of result.apps) write(`apps/${app.id}.json`, app);

// The static website is served next to the API, so relative URLs work on GitHub Pages.
const siteDir = path.join(REPO_ROOT, "site");
const distDir = path.join(REPO_ROOT, "dist");
fs.cpSync(siteDir, distDir, { recursive: true });

// Assemble pages: shared header/footer, active nav link, canonical URLs.
const siteUrl = normaliseSiteUrl(process.env.SITE_URL);
const header = fs.readFileSync(path.join(siteDir, "partials", "header.html"), "utf8");
const footer = fs.readFileSync(path.join(siteDir, "partials", "footer.html"), "utf8");
fs.rmSync(path.join(distDir, "partials"), { recursive: true, force: true });

const pages = fs.readdirSync(distDir).filter((f) => f.endsWith(".html"));
for (const file of pages) {
  const full = path.join(distDir, file);
  const html = renderPage(fs.readFileSync(full, "utf8"), { file, header, footer, siteUrl });
  const leftover = html.match(/<!--@\w+-->|\{\{\w+\}\}/);
  if (leftover) {
    console.error(`✖ ${file}: unresolved placeholder ${leftover[0]}`);
    process.exit(1);
  }
  fs.writeFileSync(full, html);
}
fs.writeFileSync(path.join(distDir, "sitemap.xml"), sitemap(siteUrl, pages));
fs.writeFileSync(path.join(distDir, "robots.txt"), robots(siteUrl));

console.log(
  `✔ Built ${result.apps.length} app(s), ${result.alternatives.length} alternative(s), ${pages.length} page(s) → dist/ (site + api/v1/)`
);
