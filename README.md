<div align="center">

# 🐧 linux-alternatives

**The open, machine-readable database of Windows apps → Linux.**
For every Windows application: what replaces it on Linux, how well, and whether it runs under Wine/Proton, with real user reports.

![Status](https://img.shields.io/badge/status-early%20stage-orange)
![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)
![Code license](https://img.shields.io/badge/code-MIT-blue)
![Data license](https://img.shields.io/badge/data-CC0-lightgrey)
![Data](https://img.shields.io/badge/data-YAML%20%2B%20JSON%20Schema-informational)

### 🌐 [**Open the live site → linux-alternatives.itasel.org**](https://linux-alternatives.itasel.org)

[Live site](https://linux-alternatives.itasel.org) · [Browse the data](#-how-the-data-looks) · [Contribute](#-contribute-in-5-minutes) · [Architecture](docs/ARCHITECTURE.md) · [Roadmap](#-roadmap)

</div>

---

## Why this exists

"Which Linux app replaces X?" is asked every single day on r/linux, Lemmy and distro forums. For **games**, [ProtonDB](https://www.protondb.com) answers it well. For everything else (CAD, engineering software, accounting, printer tools, niche professional apps) there is no good open source of truth:

| Existing source | The problem |
| --- | --- |
| WineHQ AppDB | Outdated, hard to browse, mostly stale ratings |
| AlternativeTo | Not open, no API, no compatibility data |
| Forum threads | Scattered, unsearchable, rot over time |

For many people, **one missing application is enough to stop the whole switch to Linux.** This project makes that question answerable, in one place, by the community.

## ✨ What you get

- 🔁 **Alternatives with honesty.** Not just "use GIMP" but *how well* it replaces the original: file-format support, keyboard shortcuts, and what is missing.
- 🍷 **Wine / Proton compatibility.** Per-app status with user reports: app version, Wine/Proton version, distro, and the exact tweaks needed.
- 🤖 **Machine-readable.** One small YAML file per app, validated by JSON Schema. Built into a JSON API and packages for npm and PyPI, so migration tools and distro installers can depend on it.
- 🔎 **Searchable site.** A static website (GitHub Pages) for humans.
- 🤝 **Built for PRs.** Adding or fixing an entry is a single small file. No code required.

## 🧩 How the data looks

One Windows application per file (`data/apps/<slug>.yaml`):

```yaml
# Illustrative example, not verified data
id: example-cad
name: Example CAD
vendor: Example Corp
category: cad
homepage: https://example.com/cad
platforms: [windows]

alternatives:
  - id: freecad
    fit: partial            # full | good | partial | minimal
    file_formats:
      import: [dwg, dxf, step]
      export: [dxf, step, stl]
    shortcuts: different    # same | similar | different
    missing:
      - Native DWG export
      - Sheet-set manager
    notes: Fine for 3D parametric work, weaker for 2D drafting.

wine:
  summary: Runs well with a few winetricks verbs.   # optional context
  # The headline status (platinum … borked, or untested) is derived from reports.
```

Compatibility reports live in their own files (`data/reports/<app>/<report>.yaml`), so many people can add reports at the same time without merge conflicts:

```yaml
app: example-cad
app_version: "2024"
runner: { type: wine, version: "9.0" }
distro: Fedora 41
status: gold
tweaks:
  - winetricks: [corefonts, vcrun2019]
notes: Installer needs `winecfg` set to Windows 10.
reporter: your-github-handle
date: 2026-01-15
```

The full schema and design rationale are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 🚀 Contribute in 5 minutes

You do **not** need to write code.

1. **Pick an app.** Look at issues labelled `good first issue` ("Add app X") or add one you know.
2. **Copy the template** `data/apps/_template.yaml` to `data/apps/<app-slug>.yaml` and fill it in.
3. **Validate locally** (optional): `npm install && npm run validate`. CI runs the same check on every PR.
4. **Open a pull request.** A maintainer reviews it, usually the same week.

> The database currently contains **109 unverified seed entries** (`verified: false`). Fit ratings are initial estimates, not tested migration results. Check the sources and notes before relying on an entry.

Just ran an app under Wine or Proton? Open a **compatibility report** using the issue template, or add a report file directly.

Ground rules:

- Only add facts you have verified yourself or can link to a source.
- Keep it neutral. No marketing language, no "X is better than Y" without specifics.
- One app per PR keeps reviews fast.

Details are in [CONTRIBUTING.md](CONTRIBUTING.md). Please also read our [Code of Conduct](docs/CODE_OF_CONDUCT.md).

## 🛠️ Develop

```bash
npm install
npm run check      # validate data + run tests + build the site and JSON API
npm run check:links # optional network check; writes JSON and Markdown reports to dist/reports/
npm run dev        # build and preview the website at http://localhost:4173
```

Requires Node.js 20+. `npm run build` writes the website and the static JSON API to `dist/` (`api/v1/index.json`, `apps.json`, `alternatives.json`, `apps/<id>.json`). `dist/` is generated and never committed. Version tags (`v*`) build and deploy it; pushes to `main` do not.

`npm run check` stays offline. `npm run check:links` checks structured homepages, source links and download URLs; then `npm run build` includes that snapshot in `/api/v1/health.json` and the Data health page. Missing, mismatched and stale snapshots are labelled explicitly. Verified entries require the complete independent review's UTC date in `verified_on`; the dashboard lists reviews older than 365 days. The weekly workflow stores reports as artifacts, and deployments run a new link check before publishing. See [data health checks](docs/DATA_HEALTH.md) for status meanings and options.

`npm run tasks:verification` writes issue drafts for unverified apps to `dist/review/verification.md` and `.json`. Each draft includes the current claims, source gaps, installation metadata and an independent-review checklist. It opens no issues and changes no data. Builds replace `dist/`, so generate drafts afterwards. See the [review guide](docs/VERIFICATION.md) for filters and evidence requirements.

Open an app's details to compare alternatives, choose a distribution and see every sourced installation option. Native packages are labelled with their distribution and repository requirements; Flatpak, Snap, AppImage and project downloads show their prerequisites. Availability is not a tested support guarantee. Cards keep the same size while the full details and compatibility reports open in a dialog.

### The website

| Page | What it does |
| --- | --- |
| **Search** (`/`) | Instant search and category filters, live database stats, deep links like `/?q=autocad` |
| **Switch planner** (`/switch.html`) | Tick the Windows apps you use and get a personal Linux plan: best alternative per app, fit ratings, what is missing and a reviewable Flatpak install script. Runs fully in the browser, the plan is shareable as a link |
| **Data health** (`/health.html`) | Coverage by category, verification and source gaps, installation metadata and the latest included link-check snapshot |
| **About** (`/about.html`) | Why the project exists, how the data is built, what the ratings mean |
| **Contribute** (`/contribute.html`) | The GitHub contribution guide in five steps, no coding required |
| **Ideas** (`/ideas.html`) | Roadmap status and open ideas |
| **For companies** (`/business.html`) | Use cases for teams and distributions, JSON API quick start, ways to get involved |

The site is plain HTML, CSS and JavaScript (no framework). The build only adds the shared header and footer from `site/partials/`, canonical URLs, `sitemap.xml` and `robots.txt`. The look follows [itasel.org](https://itasel.org) (dark-first, gold accent, Montserrat), with a light theme for systems that prefer it. Set `SITE_URL` when building for a different domain: `SITE_URL=https://example.org npm run build`.

## 🌐 Hosting

The website is plain static files, so it can be served from anywhere:

- **GitHub Pages**: deployed when you push a version tag such as `v0.3.3` (one-time setup: Settings → Pages → Source: *GitHub Actions*, and in Settings → Environments → `github-pages` add the tag rule `v*`).
- **Your own server**: ready-made Docker image, nginx config with strict security headers, and an optional rsync deploy that runs when you push a version tag (`git tag v0.3.0 && git push origin v0.3.0`). The public instance runs at **[linux-alternatives.itasel.org](https://linux-alternatives.itasel.org)**, so people who are not contributors can browse and search without a GitHub account.

```bash
# Self-host with Docker (listens on 127.0.0.1:8080, put a TLS proxy in front)
docker compose -f deploy/docker-compose.yml up -d --build
```

Step-by-step guide, including DNS, HTTPS and automatic deploys: [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md).

## 🗺️ Roadmap

**Guiding idea: trust before reach.** Today the database has about 110 apps and 43 alternatives with sourced install routes per distribution, but **no verified entries and no compatibility reports yet**. We fix that before we announce anything. The full plan, exit criteria and metrics are in **[docs/ROADMAP.md](docs/ROADMAP.md)**.

**Done**

- [x] **v0.1 Foundation**: data model, JSON Schemas, validation, build, CI on every PR, MIT + CC0 licenses, contributing guide, issue and PR templates
- [x] **v0.2 Website and hosting**: search, app details and reports, switch planner, project pages, JSON API, Docker/nginx kit, [live site](https://linux-alternatives.itasel.org), GitHub Pages and own-server deploy on version tags
- [x] Sourced per-distribution install routes for every alternative
- [x] Data health dashboard and scheduled source-link reports
- [x] Local verification-task drafts, review guide and evidence issue form

**Next**

- [ ] **v0.3 Trust**: verify the first 25 apps, collect the first 10 compatibility reports, seed the professional niche (CAD, engineering, accounting, printing, audio), review source-link reports, publish reviewed contribution tasks (generator and report-draft tool are in place), and finish the repository settings (labels, branch/tag protection, private vulnerability reporting; `SECURITY.md`, code owners and Dependabot are done)
- [ ] **v0.4 Planner 2.0**: distribution-aware plans, more exports, team assessment from a pasted program list, compare view
- [ ] **v0.5 Distribution**: typed `npm` and `PyPI` packages published on tags, JSON Schema and feed for the API, citable data releases
- [ ] **v0.6 Reach**: public announcement (r/linux, Lemmy, distro forums), translations, "Coming from Windows?" widget, browser extension
- [ ] **v1.0 Stable**: stable schema, 150+ apps with at least half verified, 50+ reports, 20+ outside contributors, 2+ downstream consumers

Have an idea? See the [ideas page](https://linux-alternatives.itasel.org/ideas.html) or open an issue.

## 🏗️ Architecture at a glance

```
data/       ← the source of truth (YAML, one file per app / alternative / report)
schema/     ← JSON Schema that every file must pass
tools/      ← validate + build scripts (YAML → dist/api/v1/*.json)
site/       ← static search website (plain HTML/CSS/JS, no build step)
deploy/     ← self-hosting: Dockerfile, compose, nginx config
docs/       ← architecture, self-hosting guide, licensing, code of conduct
packages/   ← npm and PyPI wrappers            (planned)
```

Read the [full proposal](docs/ARCHITECTURE.md) for the data model, build pipeline, versioning and governance.

## 📜 License

- **Code** (tools, CI, docs): [MIT](LICENSE)
- **Data** (`data/`, `schema/`): [CC0 1.0](LICENSE-DATA), public domain, free to reuse with no attribution

Details and contributor terms are in [docs/LICENSING.md](docs/LICENSING.md). Product names belong to their owners; this project is not affiliated with any vendor.

---

<div align="center">
Made by the community, for everyone who is one app away from switching. ⭐ Star the repo if you want this to exist.
</div>
