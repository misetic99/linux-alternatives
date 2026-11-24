<div align="center">

# 🐧 linux-alternatives

**The open, machine-readable database of Windows apps → Linux.**
For every Windows application: what replaces it on Linux, how well, and whether it runs under Wine/Proton, with real user reports.

![Status](https://img.shields.io/badge/status-early%20stage-orange)
![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)
![Code license](https://img.shields.io/badge/code-MIT-blue)
![Data license](https://img.shields.io/badge/data-CC0-lightgrey)
![Data](https://img.shields.io/badge/data-YAML%20%2B%20JSON%20Schema-informational)

[Browse the data](#-how-the-data-looks) · [Contribute](#-contribute-in-5-minutes) · [Architecture](docs/ARCHITECTURE.md) · [Roadmap](#-roadmap)

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

> The database currently contains a handful of **unverified seed entries** (`verified: false`) so the format can be exercised. They need your review.

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
npm run dev        # build and preview the website at http://localhost:4173
```

Requires Node.js 20+. `npm run build` writes the website and the static JSON API to `dist/` (`api/v1/index.json`, `apps.json`, `alternatives.json`, `apps/<id>.json`). `dist/` is generated and never committed. Merges to `main` deploy it to GitHub Pages.

Expand an app's details on the site to see its official links and compatibility reports, newest first. Each report shows the tested app and runner versions, distribution, date, reporter, adjustments and notes. Alternative entries also expose their source links when provided.

## 🌐 Hosting

The website is plain static files, so it can be served from anywhere:

- **GitHub Pages**: deployed automatically on merges to `main` (one-time setup: Settings → Pages → Source: *GitHub Actions*).
- **Your own server**: ready-made Docker image, nginx config with strict security headers, and an optional rsync deploy workflow. The public instance is planned at **linux-alternatives.itasel.org**, so people who are not contributors can browse and search without a GitHub account.

```bash
# Self-host with Docker (listens on 127.0.0.1:8080, put a TLS proxy in front)
docker compose -f deploy/docker-compose.yml up -d --build
```

Step-by-step guide, including DNS, HTTPS and automatic deploys: [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md).

## 🗺️ Roadmap

- [x] Project vision and architecture proposal
- [x] **v0.1** Repository skeleton: `data/`, JSON Schemas, validation, build, CI on every PR
- [x] Licenses (MIT for code, CC0 for data), contributing guide, issue and PR templates
- [ ] **v0.1** Seed the database with the 50–100 most requested apps (25 unverified seeds so far)
- [x] **v0.2** Static search site (deploys to GitHub Pages)
- [x] **v0.2** Self-hosting kit (Docker, nginx, optional rsync deploy) for linux-alternatives.itasel.org
- [ ] Go live on linux-alternatives.itasel.org
- [ ] **v0.2** `good first issue` backlog
- [ ] **v0.3** Published packages: `npm` and `PyPI` with a typed API
- [ ] **v0.3** Public announcement (r/linux, Lemmy, distro forums)
- [ ] **v1.0** 20+ outside contributors, stable schema, "Coming from Windows?" widget for distros and themes

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
