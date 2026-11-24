// Switch planner UI. All data is rendered with textContent (never innerHTML).
// The selection lives only in the URL hash, so plans are shareable and nothing is stored.
"use strict";

(() => {
  const { buildPlan, buildScript, parseHash, toHash } = globalThis.PlanCore;
  const FIT_LABEL = { full: "Full replacement", good: "Good fit", partial: "Partial fit", minimal: "Minimal fit" };
  const $ = (id) => document.getElementById(id);
  const state = { apps: [], selected: new Set(), filter: "" };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderPick() {
    const q = state.filter.trim().toLowerCase();
    const list = state.apps.filter((a) => {
      if (!q) return true;
      return [a.name, a.vendor, ...(a.aliases || [])].join(" ").toLowerCase().includes(q);
    });
    $("pick-list").replaceChildren(...list.map((app) => {
      const li = el("li");
      const label = el("label", "pick");
      const box = el("input");
      box.type = "checkbox";
      box.checked = state.selected.has(app.id);
      box.addEventListener("change", () => {
        if (box.checked) state.selected.add(app.id); else state.selected.delete(app.id);
        update();
      });
      label.append(box, el("span", "pick-name", app.name), el("span", "pick-meta", app.category));
      li.append(label);
      return li;
    }));
  }

  function planItem(item) {
    const li = el("li", item.primary ? "plan-item" : "plan-item gap");
    if (!item.primary) {
      li.append(el("strong", null, item.app.name));
      const p = el("p", "meta", "No known Linux alternative yet. ");
      const a = el("a", null, "Help add one");
      a.href = "https://github.com/misetic99/linux-alternatives/issues/new/choose";
      a.rel = "noopener noreferrer";
      p.append(a);
      li.append(p);
      return li;
    }
    const alt = item.primary.alternative;
    const head = el("div", "alt-head");
    head.append(el("span", "alt-name", `${item.app.name} → ${alt.name}`));
    head.append(el("span", `badge f-${item.primary.fit}`, FIT_LABEL[item.primary.fit] || item.primary.fit));
    li.append(head);
    if (item.primary.missing && item.primary.missing.length) {
      li.append(el("p", "meta", `Missing: ${item.primary.missing.join("; ")}`));
    }
    if (item.primary.notes) li.append(el("p", "meta", item.primary.notes));
    if (item.others.length) {
      li.append(el("p", "meta", `Also consider: ${item.others.map((o) => o.alternative.name).join(", ")}`));
    }
    if (!item.app.verified) li.append(el("span", "badge muted", "unverified"));
    return li;
  }

  function update() {
    const ids = [...state.selected];
    const plan = buildPlan(state.apps, ids);

    $("plan-list").replaceChildren(...plan.items.map(planItem));
    $("meter").value = plan.total ? Math.round((plan.covered / plan.total) * 100) : 0;

    if (!plan.total) {
      $("summary").textContent = "Select apps on the left to build your plan.";
      $("breakdown").textContent = "";
    } else {
      $("summary").textContent = `${plan.covered} of ${plan.total} apps have a known Linux alternative`;
      const c = plan.counts;
      const parts = [
        c.full && `${c.full} full`, c.good && `${c.good} good`, c.partial && `${c.partial} partial`,
        c.minimal && `${c.minimal} minimal`, c.none && `${c.none} without alternative`,
      ].filter(Boolean);
      const note = plan.unverified ? ` ${plan.unverified} of these entries are still unverified.` : "";
      $("breakdown").textContent = `Best fit per app: ${parts.join(", ")}.${note}`;
    }

    $("script").value = plan.total ? buildScript(plan) : "";
    for (const id of ["copy-script", "copy-link", "clear"]) $(id).disabled = !plan.total;

    try {
      history.replaceState(null, "", toHash(ids) || location.pathname + location.search);
    } catch { /* hash sync is a convenience only */ }
  }

  function say(message) {
    $("status").textContent = message;
  }

  async function copy(text, done) {
    try {
      await navigator.clipboard.writeText(text);
      say(done);
    } catch {
      if (text === $("script").value) {
        $("script").focus();
        $("script").select();
        say("Press Ctrl+C (or Cmd+C) to copy the selected text.");
      } else {
        say(`Copy this link: ${text}`);
      }
    }
  }

  async function main() {
    try {
      const res = await fetch("api/v1/apps.json");
      if (!res.ok) throw new Error(String(res.status));
      state.apps = await res.json();
    } catch {
      $("error").hidden = false;
      $("planner").hidden = true;
      return;
    }
    state.selected = new Set(parseHash(location.hash, state.apps.map((a) => a.id)));

    $("pick-q").addEventListener("input", (e) => { state.filter = e.target.value; renderPick(); });
    $("copy-script").addEventListener("click", () => copy($("script").value, "Install script copied."));
    $("copy-link").addEventListener("click", () => copy(location.href, "Share link copied."));
    $("clear").addEventListener("click", () => { state.selected.clear(); renderPick(); update(); say(""); });

    renderPick();
    update();
  }

  main();
})();
