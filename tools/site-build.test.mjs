import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  DEFAULT_SITE_URL, normaliseSiteUrl, canonicalFor, renderPage, sitemap, robots,
} from "./site-build.mjs";

const header = '<nav><a href="./" data-nav="home">Search</a><a href="about.html" data-nav="about">About</a></nav>';
const footer = "<footer>end</footer>";

test("site url defaults to the public domain and is validated", () => {
  assert.equal(normaliseSiteUrl(undefined), DEFAULT_SITE_URL);
  assert.equal(normaliseSiteUrl("https://example.org/"), "https://example.org");
  assert.throws(() => normaliseSiteUrl("javascript:alert(1)"));
  assert.throws(() => normaliseSiteUrl("not a url"));
});

test("canonical URLs map index to the root", () => {
  assert.equal(canonicalFor("https://x.org", "index.html"), "https://x.org/");
  assert.equal(canonicalFor("https://x.org", "about.html"), "https://x.org/about.html");
});

test("pages get the shared header and footer, canonical URL and active link", () => {
  const html = '<body data-page="about"><!--@header-->main<!--@footer--><link href="{{canonical}}"></body>';
  const out = renderPage(html, { file: "about.html", header, footer, siteUrl: "https://x.org" });
  assert.match(out, /data-nav="about" aria-current="page"/);
  assert.doesNotMatch(out, /data-nav="home" aria-current/);
  assert.match(out, /<footer>end<\/footer>/);
  assert.match(out, /href="https:\/\/x\.org\/about\.html"/);
  assert.doesNotMatch(out, /<!--@|\{\{/);
});

test("sitemap lists pages but not the 404 page; robots points to it", () => {
  const xml = sitemap("https://x.org", ["index.html", "about.html", "404.html", "style.css"]);
  assert.match(xml, /<loc>https:\/\/x\.org\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/x\.org\/about\.html<\/loc>/);
  assert.doesNotMatch(xml, /404|style\.css/);
  assert.match(robots("https://x.org"), /Sitemap: https:\/\/x\.org\/sitemap\.xml/);
});

test("every source page is self-contained for the strict CSP", () => {
  const dir = new URL("../site/", import.meta.url);
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".html"))) {
    const html = fs.readFileSync(new URL(file, dir), "utf8");
    assert.doesNotMatch(html, /\sstyle\s*=/i, `${file}: inline style attribute`);
    assert.doesNotMatch(html, /\son[a-z]+\s*=/i, `${file}: inline event handler`);
    assert.doesNotMatch(html, /<script(?![^>]*\ssrc=)[^>]*>/i, `${file}: inline script`);
    assert.doesNotMatch(html, /(?:src|href)=["']https?:\/\/(?!github\.com|itasel\.org|creativecommons\.org|linux-alternatives\.itasel\.org|example\.com)/i, `${file}: unexpected external resource`);
  }
});
