// Client-side search over the static JSON API. All data is rendered with
// textContent (never innerHTML), because it comes from community pull requests.
"use strict";

const API = "api/v1/apps.json";
const FIT_LABEL = { full: "Full replacement", good: "Good fit", partial: "Partial fit", minimal: "Minimal fit" };
const STATUS_LABEL = {
  platinum: "Wine: platinum", gold: "Wine: gold", silver: "Wine: silver",
  bronze: "Wine: bronze", borked: "Wine: borked", untested: "Wine: untested",
};
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/;
const INSTALL_CMD = {
  apt: (r) => `sudo apt install ${r}`,
  dnf: (r) => `sudo dnf install ${r}`,
  pacman: (r) => `sudo pacman -S ${r}`,
  flatpak: (r) => `flatpak install flathub ${r}`,
  snap: (r) => `sudo snap install ${r}`,
};

const $ = (id) => document.getElementById(id);
const state = { apps: [], query: "", category: "all" };

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
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

function formats(link) {
  const f = link.file_formats || {};
  const parts = [];
  if (f.import && f.import.length) parts.push(`opens ${f.import.join(", ")}`);
  if (f.export && f.export.length) parts.push(`saves ${f.export.join(", ")}`);
  return parts.join(" · ");
}

function renderAlternative(link) {
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

  const line = [alt.license, formats(link), link.shortcuts ? `${link.shortcuts} shortcuts` : ""]
    .filter(Boolean).join(" · ");
  if (line) box.append(el("p", null, line));

  if (link.missing && link.missing.length) {
    const ul = el("ul");
    for (const m of link.missing) ul.append(el("li", null, `Missing: ${m}`));
    box.append(ul);
  }
  if (link.notes) box.append(el("p", null, link.notes));

  const install = (alt.install || []).find((i) => INSTALL_CMD[i.method] && SAFE_REF.test(i.ref));
  if (install) box.append(el("code", "cmd", INSTALL_CMD[install.method](install.ref)));
  return box;
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

  if (app.wine.summary) card.append(el("p", "meta", app.wine.summary));
  if (app.alternatives.length === 0) card.append(el("p", "meta", "No alternatives listed yet."));
  for (const link of app.alternatives) card.append(renderAlternative(link));
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
  renderChips();
  $("q").addEventListener("input", (e) => { state.query = e.target.value; render(); });
  render();
}

main();
