// Client-side search over the static JSON API. All data is rendered with
// textContent (never innerHTML), because it comes from community pull requests.
"use strict";

const API = "api/v1/apps.json";
const FIT_LABEL = { full: "Full replacement", good: "Good fit", partial: "Partial fit", minimal: "Minimal fit" };
const STATUS_LABEL = {
  platinum: "Compatibility: platinum", gold: "Compatibility: gold", silver: "Compatibility: silver",
  bronze: "Compatibility: bronze", borked: "Compatibility: borked", untested: "Compatibility: untested",
};
const RUNNER_LABEL = { wine: "Wine", proton: "Proton", bottles: "Bottles", crossover: "CrossOver", vm: "Virtual machine", other: "Other runner" };
const Install = globalThis.InstallCore;

const $ = (id) => document.getElementById(id);
const state = { apps: [], query: "", category: "all", distro: "all", dialog: null };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function badge(text, className) {
  return el("span", `badge ${className}`, text);
}

function isHttp(url) {
  return Install.isHttp(url);
}

function externalLink(label, url) {
  const a = el("a", null, label);
  a.href = url;
  a.rel = "noopener noreferrer";
  return a;
}

function renderSources(sources) {
  const links = (sources || []).filter(isHttp);
  if (!links.length) return null;
  const details = el("details", "sources");
  details.append(el("summary", null, `Sources (${links.length})`));
  const list = el("ul");
  for (const url of links) {
    const item = el("li");
    item.append(externalLink(url, url));
    list.append(item);
  }
  details.append(list);
  return details;
}

function renderReport(report) {
  const item = el("li", "report");
  item.append(el("h4", null, `Version ${report.app_version}`));
  item.append(badge(`Result: ${report.status}`, `s-${report.status}`));
  item.append(el("p", "meta", `${RUNNER_LABEL[report.runner.type] || report.runner.type} ${report.runner.version} · ${report.distro}`));
  const attribution = el("p", "meta");
  const date = el("time", null, report.date);
  date.dateTime = report.date;
  attribution.append(date, document.createTextNode(` · Reported by ${report.reporter}`));
  item.append(attribution);

  const tweaks = report.tweaks || {};
  const adjustments = el("ul", "tweaks");
  if (tweaks.windows_version) adjustments.append(el("li", null, `Windows version: ${tweaks.windows_version}`));
  if (tweaks.winetricks?.length) adjustments.append(el("li", null, `Winetricks: ${tweaks.winetricks.join(", ")}`));
  for (const [name, value] of Object.entries(tweaks.env || {})) {
    const entry = el("li");
    entry.append(el("code", null, `${name}=${value}`));
    adjustments.append(entry);
  }
  if (adjustments.children.length) {
    item.append(el("p", "report-label", "Reported adjustments"), adjustments);
  }
  if (report.notes) item.append(el("p", "report-notes", report.notes));
  return item;
}

function renderDetails(app) {
  const details = el("details", "app-details");
  const reports = [...(app.reports || [])].sort((a, b) => b.date.localeCompare(a.date));
  details.append(el("summary", null, `App details and reports (${reports.length})`));
  if (app.aliases?.length) details.append(el("p", "meta", `Also known as: ${app.aliases.join(", ")}`));
  const links = el("p", "detail-links");
  if (isHttp(app.homepage)) links.append(externalLink("Official website", app.homepage));
  if (isHttp(app.wine.appdb_url)) links.append(externalLink("WineHQ reference", app.wine.appdb_url));
  if (links.children.length) details.append(links);

  details.append(el("h3", null, "Compatibility reports"));
  if (!reports.length) {
    details.append(el("p", "meta", "No compatibility reports yet. Compatibility is untested."));
  } else {
    details.append(el("p", "meta", "Results apply to the listed app and runner versions. The headline status uses the most common result; ties use the newest report."));
    const list = el("ol", "reports");
    list.append(...reports.map(renderReport));
    details.append(list);
  }
  return details;
}

function formats(link) {
  const f = link.file_formats || {};
  const parts = [];
  if (f.import && f.import.length) parts.push(`opens ${f.import.join(", ")}`);
  if (f.export && f.export.length) parts.push(`saves ${f.export.join(", ")}`);
  return parts.join(" · ");
}

function distroSelect(id) {
  const select = el("select");
  select.id = id;
  const all = el("option", null, "All distributions");
  all.value = "all";
  select.append(all);
  for (const [key, label] of Object.entries(Install.DISTROS)) {
    if (key === "any") continue;
    const option = el("option", null, label);
    option.value = key;
    select.append(option);
  }
  select.value = state.distro;
  return select;
}

function renderInstall(alt) {
  const section = el("section", "install-panel");
  section.append(el("h4", null, "Installation options"));
  const routes = Install.routes(alt, state.distro);
  if (!routes.length) {
    section.append(el("p", "meta", `No sourced installation option is listed for ${Install.distroLabel(state.distro)}. This does not mean the application is unsupported.`));
    if (isHttp(alt.homepage)) section.append(externalLink("Check the project website", alt.homepage));
    return section;
  }
  for (const route of routes) {
    const row = el("div", "install-route");
    const distros = route.distros?.length ? route.distros.map(Install.distroLabel).join(", ") : "Distribution not specified";
    row.append(el("h5", null, `${Install.METHODS[route.method]} · ${distros}`));
    const cmd = Install.command(route);
    if (cmd) {
      row.append(el("code", "cmd", cmd));
      const copy = el("button", "copy-command", "Copy command");
      copy.type = "button";
      copy.setAttribute("aria-label", `Copy ${Install.METHODS[route.method]} command for ${alt.name}`);
      copy.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(cmd); copy.textContent = "Copied"; }
        catch { copy.textContent = "Select and copy the command above"; }
      });
      row.append(copy);
    } else {
      row.append(externalLink(route.method === "appimage" ? "Download AppImage" : "Open download instructions", route.ref));
    }
    if (route.method === "flatpak") row.append(externalLink("Set up Flatpak and Flathub", "https://flathub.org/en/setup"));
    if (route.notes) row.append(el("p", "fine", route.notes));
    const sources = renderSources(route.sources);
    if (sources) row.append(sources);
    section.append(row);
  }
  return section;
}

function renderAlternative(link, installations) {
  const alt = link.alternative;
  const box = el("div", "alt");

  const head = el("div", "alt-head");
  if (isHttp(alt.homepage)) {
    const a = el("a", "alt-name", alt.name);
    a.href = alt.homepage;
    a.rel = "noopener noreferrer";
    head.append(a);
  } else {
    head.append(el("span", "alt-name", alt.name));
  }
  head.append(badge(FIT_LABEL[link.fit] || link.fit, `f-${link.fit}`));
  box.append(head);
  if (alt.description) box.append(el("p", null, alt.description));

  const line = [alt.license, formats(link), link.shortcuts ? `${link.shortcuts} shortcuts` : ""]
    .filter(Boolean).join(" · ");
  if (line) box.append(el("p", null, line));

  const install = el("div");
  install.append(renderInstall(alt));
  installations.push({ alt, container: install });
  box.append(install);

  if (link.missing && link.missing.length) {
    const ul = el("ul");
    for (const m of link.missing) ul.append(el("li", null, `Missing: ${m}`));
    box.append(ul);
  }
  if (link.notes) box.append(el("p", null, link.notes));
  const sources = renderSources(link.sources);
  if (sources) box.append(sources);

  return box;
}

function openApp(app) {
  if (!state.dialog) {
    state.dialog = el("dialog", "app-dialog");
    document.body.append(state.dialog);
  }
  const dialog = state.dialog;
  dialog.setAttribute("aria-labelledby", "dialog-title");
  const header = el("div", "dialog-head");
  const title = el("h2", null, app.name);
  title.id = "dialog-title";
  const close = el("button", "btn btn-ghost btn-sm", "Close");
  close.type = "button";
  close.autofocus = true;
  close.setAttribute("aria-label", "Close app details");
  close.addEventListener("click", () => dialog.close());
  header.append(title, close);

  const body = el("div", "dialog-body");
  body.append(el("p", "meta", `${app.vendor} · ${app.category}`));
  if (!app.verified) body.append(el("p", "fine", "Unverified comparison. Review sources and migration notes."));
  else body.append(el("p", "fine", `Last complete independent review: ${app.verified_on}.`));
  const controls = el("div", "catalog-toolbar dialog-toolbar");
  const label = el("label", null, "Installation options for");
  label.htmlFor = "detail-distro";
  const select = distroSelect("detail-distro");
  controls.append(label, select);
  body.append(controls, el("p", "fine", "Installation availability is not a tested support guarantee. Check release, architecture and runtime requirements."));
  const alternatives = el("div", "detail-alternatives");
  const installations = [];
  for (const link of app.alternatives) alternatives.append(renderAlternative(link, installations));
  if (!app.alternatives.length) alternatives.append(el("p", "meta", "No alternatives listed yet."));
  select.addEventListener("change", (event) => {
    state.distro = event.target.value;
    $("distro").value = state.distro;
    for (const { alt, container } of installations) container.replaceChildren(renderInstall(alt));
  });
  body.append(alternatives, renderDetails(app));
  dialog.replaceChildren(header, body);
  dialog.showModal();
  dialog.scrollTop = 0;
}

function renderCard(app) {
  const card = el("article", "card");
  card.append(el("h2", null, app.name));
  card.append(el("p", "meta", `${app.vendor} · ${app.category}`));

  const row = el("div", "row");
  const status = app.wine.status || "untested";
  row.append(badge(STATUS_LABEL[status] || status, `s-${status}`));
  if (app.wine.report_count) row.append(badge(`${app.wine.report_count} report(s)`, "muted"));
  if (!app.verified) row.append(badge("unverified", "muted"));
  card.append(row);

  const preview = el("div", "card-preview");
  preview.append(el("p", "card-label", `${app.alternatives.length} Linux alternative${app.alternatives.length === 1 ? "" : "s"}`));
  const names = el("ul", "card-alternatives");
  for (const link of app.alternatives.slice(0, 3)) {
    const line = el("li");
    line.append(el("span", null, link.alternative.name), el("span", "fine", FIT_LABEL[link.fit] || link.fit));
    names.append(line);
  }
  preview.append(names);
  if (app.alternatives.length > 3) preview.append(el("p", "fine", `+${app.alternatives.length - 3} more in details`));
  card.append(preview);
  const view = el("button", "btn btn-ghost card-open", "Alternatives & install options");
  view.type = "button";
  view.setAttribute("aria-haspopup", "dialog");
  view.setAttribute("aria-label", `View alternatives and installation options for ${app.name}`);
  view.addEventListener("click", () => openApp(app));
  card.append(view);
  return card;
}

function matches(app, q) {
  if (!q) return true;
  const haystack = [
    app.name, app.vendor, ...(app.aliases || []),
    ...app.alternatives.map((l) => l.alternative.name),
  ].join(" ").toLowerCase();
  return q.split(/\s+/).every((word) => haystack.includes(word));
}

function renderStats() {
  const altIds = new Set();
  let reports = 0;
  let verified = 0;
  for (const app of state.apps) {
    for (const link of app.alternatives) altIds.add(link.id);
    reports += (app.reports || []).length;
    if (app.verified) verified += 1;
  }
  const set = (id, value) => {
    const node = $(id);
    if (node) node.textContent = String(value);
  };
  set("stat-apps", state.apps.length);
  set("stat-alts", altIds.size);
  set("stat-reports", reports);
  set("stat-verified", verified);
}

// Deep links such as /?q=autocad. Skipped when the browser APIs are missing.
function initialQuery() {
  if (typeof location === "undefined" || typeof URLSearchParams === "undefined") return "";
  return new URLSearchParams(location.search).get("q") || "";
}

function syncUrl() {
  if (typeof history === "undefined" || typeof location === "undefined") return;
  const q = state.query.trim();
  try {
    history.replaceState(null, "", q ? `?q=${encodeURIComponent(q)}` : location.pathname);
  } catch { /* the URL is a convenience only */ }
}

function render() {
  const q = state.query.trim().toLowerCase();
  const list = state.apps.filter(
    (a) => (state.category === "all" || a.category === state.category) && matches(a, q)
  );
  const results = $("results");
  results.replaceChildren(...list.map(renderCard));
  $("count").textContent = `${list.length} of ${state.apps.length} apps`;
  $("empty").hidden = list.length !== 0;
}

function renderChips() {
  const cats = ["all", ...new Set(state.apps.map((a) => a.category))].sort((a, b) =>
    a === "all" ? -1 : b === "all" ? 1 : a.localeCompare(b)
  );
  const wrap = $("chips");
  wrap.replaceChildren(...cats.map((c) => {
    const b = el("button", "chip", c === "all" ? "All" : c);
    b.type = "button";
    b.setAttribute("aria-pressed", String(c === state.category));
    b.addEventListener("click", () => {
      state.category = c;
      for (const chip of wrap.children) chip.setAttribute("aria-pressed", String(chip === b));
      render();
    });
    return b;
  }));
}

async function main() {
  try {
    const res = await fetch(API);
    if (!res.ok) throw new Error(String(res.status));
    state.apps = await res.json();
  } catch {
    $("error").hidden = false;
    return;
  }
  renderStats();
  renderChips();
  const distro = $("distro");
  const choices = distroSelect("distro");
  distro.replaceChildren(...choices.children);
  distro.addEventListener("change", (event) => { state.distro = event.target.value; });
  state.query = initialQuery();
  $("q").value = state.query;
  $("q").addEventListener("input", (e) => { state.query = e.target.value; syncUrl(); render(); });
  render();
}

main();
