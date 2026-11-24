"use strict";

const HealthUI = (() => {
  const LABELS = {
    ok: "Reachable", redirected: "Redirected", broken: "Broken", blocked: "Blocked",
    temporary: "Temporary / rate-limited", timeout: "Timed out", unreachable: "Network error",
    invalid: "Invalid URL", http_error: "Other HTTP error",
  };
  const $ = (id) => document.getElementById(id);
  const state = { links: [], filter: "review", shown: 30 };
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function link(text, href) {
    const node = el("a", null, text);
    node.href = href;
    node.rel = "noopener noreferrer";
    return node;
  }
  function date(value) {
    return new Date(value).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }) + " UTC";
  }
  function stat(value, label, detail) {
    const box = el("div", "stat");
    box.append(el("strong", null, value), el("span", null, label));
    if (detail) box.append(el("p", "fine", detail));
    return box;
  }
  function reviewList(title, items, appLinks) {
    const box = el("details", "feature health-review");
    box.append(el("summary", null, `${title} (${items.length})`));
    if (!items.length) box.append(el("p", null, "No entries in this queue."));
    const list = el("ul", "health-queue");
    for (const item of items) {
      const row = el("li");
      row.append(appLinks ? link(item.name, `./?q=${encodeURIComponent(item.name)}`) : el("span", null, item.name));
      if (item.category) row.append(el("span", "fine", item.category));
      list.append(row);
    }
    box.append(list);
    return box;
  }
  function renderLinks() {
    const filtered = state.links.filter((item) => state.filter === "all" || (state.filter === "review" ? !["ok", "redirected"].includes(item.state) : item.state === state.filter));
    $("health-links").replaceChildren(...filtered.slice(0, state.shown).map((item) => {
      const row = el("li", "health-link");
      row.append(el("span", `badge link-${item.state}`, `${LABELS[item.state] || item.state}${item.status ? ` · HTTP ${item.status}` : ""}`));
      let http = false;
      try { http = ["http:", "https:"].includes(new URL(item.url).protocol); } catch { /* Render malformed URLs as text. */ }
      row.append(http ? link(item.url, item.url) : el("span", null, item.url));
      if (item.detail) row.append(el("p", "fine", item.detail));
      const refs = el("details", "sources");
      refs.append(el("summary", null, `Used in ${item.references.length} field${item.references.length === 1 ? "" : "s"}`));
      const list = el("ul");
      for (const ref of item.references) list.append(el("li", null, `${ref.file}: ${ref.field}`));
      refs.append(list);
      row.append(refs);
      return row;
    }));
    const visible = Math.min(state.shown, filtered.length);
    $("link-list-count").textContent = filtered.length ? `Showing ${visible} of ${filtered.length} links` : "No links match this filter.";
    $("more-links").hidden = visible >= filtered.length;
  }
  function render(data) {
    const c = data.counts;
    $("health-updated").textContent = `Catalog metrics generated ${date(data.generated_at)}`;
    $("health-stats").replaceChildren(
      stat(c.apps, "Windows apps"), stat(c.alternatives, "Linux alternatives"),
      stat(c.verified_apps, "verified apps", `${c.verified_percent}% of entries`),
      stat(c.reports, "compatibility reports", `${c.apps_with_reports} apps have reports`),
      stat(c.install_routes, "installation options", `${c.sourced_install_routes} with distribution, source and setup notes`),
      stat(c.unique_urls, "unique source URLs"),
    );
    $("category-summary").textContent = `${c.covered_categories} of ${c.target_categories} main categories have at least five apps. Other is shown separately as a catch-all category.`;
    const max = Math.max(1, ...data.categories.map((row) => row.apps));
    $("health-categories").replaceChildren(...data.categories.map((category) => {
      const row = el("tr");
      const name = el("th", null, category.id);
      name.scope = "row";
      const apps = el("td");
      const bar = el("progress", "meter");
      bar.max = max;
      bar.value = category.apps;
      bar.setAttribute("aria-label", `${category.id}: ${category.apps} apps`);
      apps.append(el("span", null, category.apps ? String(category.apps) : "0 · no entries"), bar);
      row.append(name, apps, el("td", null, category.verified), el("td", null, category.reports), el("td", null, category.alternatives));
      return row;
    }));
    const review = data.review;
    $("health-review").replaceChildren(
      reviewList("Comparisons needing sources", review.without_comparison_sources, true),
      reviewList("Apps without alternatives", review.without_alternatives, true),
      reviewList("Unverified entries", review.unverified, true),
      reviewList("Incomplete installation metadata", review.incomplete_install_metadata, false),
    );
    $("health-freshness").textContent = `Verification dates are not recorded, so verification age is unknown. ${review.reports_over_one_year_old} compatibility reports are more than one year old.${review.latest_report ? ` Latest report: ${review.latest_report}.` : " No compatibility reports have been submitted."}`;
    const snapshot = data.links;
    const messages = {
      missing: "No link-check results are available for this catalog. Source availability is unknown.",
      invalid: "The saved link-check report is incomplete or invalid. Source availability is unknown.",
      outdated: "The saved link check does not match the current catalog URLs. A new check is needed.",
    };
    $("link-summary").textContent = messages[snapshot.state] || `${snapshot.total} unique URLs checked ${date(snapshot.checked_at)}.${snapshot.state === "stale" ? " These results are more than 14 days old." : ""}`;
    state.links = snapshot.results || [];
    $("link-counts").replaceChildren(...Object.entries(snapshot.counts || {}).map(([key, count]) => stat(count, LABELS[key] || key)));
    const filter = $("link-filter");
    for (const [key, label] of Object.entries(LABELS)) {
      const option = el("option", null, label);
      option.value = key;
      filter.append(option);
    }
    filter.disabled = !snapshot.counts;
    filter.addEventListener("change", (event) => { state.filter = event.target.value; state.shown = 30; renderLinks(); });
    $("more-links").addEventListener("click", () => { state.shown += 30; renderLinks(); });
    renderLinks();
    if (!snapshot.counts) $("link-list-count").textContent = "Link results are not available for this catalog.";
    $("health-content").hidden = false;
  }
  async function main() {
    try {
      const response = await fetch("api/v1/health.json");
      if (!response.ok) throw new Error(String(response.status));
      render(await response.json());
    } catch {
      $("health-updated").textContent = "Catalog metrics are unavailable.";
      $("health-error").hidden = false;
    }
  }
  return { main };
})();

HealthUI.main();
