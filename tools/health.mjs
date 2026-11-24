import { LINK_STATES, inventoryDigest } from "./links.mjs";

const DAY = 86400000;

/** Validate a complete snapshot against the exact current URL inventory before using its counts. */
export function linkSnapshot(inventory, report, now = new Date()) {
  const base = { total: inventory.length, checked_at: null, results: [], counts: null };
  if (!report) return { ...base, state: "missing" };
  const checked = Date.parse(report.checked_at);
  if (report.report_version !== 1 || typeof report.checked_at !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(report.checked_at) ||
    !Number.isFinite(checked) || checked > now.getTime() + 5 * 60000 || !Array.isArray(report.results)) return { ...base, state: "invalid" };
  if (report.inventory_digest !== inventoryDigest(inventory)) return { ...base, state: "outdated", checked_at: report.checked_at };
  const expected = new Map(inventory.map((item) => [item.url, item]));
  const seen = new Set();
  const results = [];
  for (const item of report.results) {
    if (!item || typeof item !== "object" || !expected.has(item.url) || seen.has(item.url) || !LINK_STATES.includes(item.state) ||
      (item.status !== undefined && (!Number.isInteger(item.status) || item.status < 100 || item.status > 599)) ||
      (["ok", "redirected"].includes(item.state) && !(item.status >= 200 && item.status < 300)) ||
      (item.state === "broken" && ![404, 410].includes(item.status))) return { ...base, state: "invalid" };
    seen.add(item.url);
    results.push({
      url: item.url, state: item.state, ...(item.status !== undefined ? { status: item.status } : {}),
      ...(item.detail ? { detail: String(item.detail).slice(0, 160) } : {}), references: expected.get(item.url).references,
    });
  }
  if (results.length !== inventory.length) return { ...base, state: "invalid" };
  const counts = Object.fromEntries(LINK_STATES.map((state) => [state, results.filter((item) => item.state === state).length]));
  return { ...base, state: now.getTime() - checked > 14 * DAY ? "stale" : "current", checked_at: report.checked_at, counts, results };
}

export function buildHealth({ apps, alternatives }, categories, inventory, { report = null, now = new Date() } = {}) {
  const brief = (app) => ({ id: app.id, name: app.name, category: app.category });
  const verified = apps.filter((app) => app.verified).length;
  const reports = apps.flatMap((app) => app.reports || []);
  const installationRoutes = alternatives.flatMap((alt) => alt.install);
  const completeRoute = (route) => !!(route.distros?.length && route.sources?.length && route.notes);
  const rows = categories.map((category) => {
    const members = apps.filter((app) => app.category === category);
    return {
      id: category, apps: members.length, verified: members.filter((app) => app.verified).length,
      reports: members.reduce((sum, app) => sum + (app.reports || []).length, 0),
      alternatives: new Set(members.flatMap((app) => app.alternatives.map((link) => link.id))).size,
    };
  });
  return {
    health_version: 1, generated_at: now.toISOString(),
    counts: {
      apps: apps.length, alternatives: alternatives.length, verified_apps: verified, unverified_apps: apps.length - verified,
      verified_percent: apps.length ? Math.round(verified / apps.length * 100) : 0,
      reports: reports.length, apps_with_reports: apps.filter((app) => (app.reports || []).length > 0).length,
      install_routes: installationRoutes.length, sourced_install_routes: installationRoutes.filter(completeRoute).length,
      unique_urls: inventory.length,
      covered_categories: rows.filter((row) => row.id !== "other" && row.apps >= 5).length,
      target_categories: categories.filter((category) => category !== "other").length,
    },
    categories: rows,
    review: {
      unverified: apps.filter((app) => !app.verified).map(brief),
      without_alternatives: apps.filter((app) => !app.alternatives.length).map(brief),
      without_comparison_sources: apps.filter((app) => app.alternatives.some((link) => !link.sources?.length)).map(brief),
      incomplete_install_metadata: alternatives.filter((alt) => alt.install.some((route) => !completeRoute(route))).map((alt) => ({ id: alt.id, name: alt.name })),
      reports_over_one_year_old: reports.filter((report) => now.getTime() - Date.parse(report.date) > 365 * DAY).length,
      latest_report: reports.map((report) => report.date).sort().at(-1) || null,
      verification_dates: "not_recorded",
    },
    links: linkSnapshot(inventory, report, now),
  };
}
