// Page assembly for the static site: shared header/footer, active nav link,
// canonical URLs, sitemap and robots.txt. Pure functions so they can be tested.

export const DEFAULT_SITE_URL = "https://linux-alternatives.itasel.org";

export function normaliseSiteUrl(value) {
  const url = String(value || DEFAULT_SITE_URL).trim().replace(/\/+$/, "");
  if (!/^https?:\/\/[^\s/]+(\/[^\s]*)?$/.test(url)) throw new Error(`Invalid SITE_URL: ${value}`);
  return url;
}

export function canonicalFor(siteUrl, file) {
  return file === "index.html" ? `${siteUrl}/` : `${siteUrl}/${file}`;
}

/** Fill the shared partials and placeholders of one HTML page. */
export function renderPage(html, { file, header, footer, siteUrl }) {
  const page = (html.match(/<body[^>]*\sdata-page="([a-z-]+)"/) || [])[1];
  const nav = page
    ? header.replace(`data-nav="${page}"`, `data-nav="${page}" aria-current="page"`)
    : header;
  return html
    .replaceAll("<!--@header-->", nav)
    .replaceAll("<!--@footer-->", footer)
    .replaceAll("{{canonical}}", canonicalFor(siteUrl, file))
    .replaceAll("{{site_url}}", siteUrl);
}

/** Pages listed in the sitemap: every HTML file except the 404 page. */
export function sitemap(siteUrl, files) {
  const urls = files
    .filter((f) => f.endsWith(".html") && f !== "404.html")
    .sort()
    .map((f) => `  <url><loc>${canonicalFor(siteUrl, f)}</loc></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

export function robots(siteUrl) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`;
}
