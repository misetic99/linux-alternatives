<div align="center">

# 🐧 linux-alternatives

**The open, machine-readable database of Windows apps → Linux.**
For every Windows application: what replaces it on Linux, how well, and whether it runs under Wine/Proton, with real user reports.

![Status](https://img.shields.io/badge/status-early%20stage-orange)
![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)
![Good first issues](https://img.shields.io/badge/good%20first%20issues-open-blue)
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
  status: gold              # platinum | gold | silver | bronze | borked | untested
  summary: Runs well with a few winetricks verbs.
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
3. **Validate locally** (optional): `npm run validate`. CI runs the same check on every PR.
4. **Open a pull request.** A maintainer reviews it, usually the same week.

Just ran an app under Wine or Proton? Open a **compatibility report** using the issue template, or add a report file directly.

Ground rules:

- Only add facts you have verified yourself or can link to a source.
- Keep it neutral. No marketing language, no "X is better than Y" without specifics.
- One app per PR keeps reviews fast.

A full `CONTRIBUTING.md` and a Code of Conduct are on the roadmap below.

## 🗺️ Roadmap

- [x] Project vision and architecture proposal
- [ ] **v0.1** Repository skeleton: `data/`, JSON Schema, CI validation on every PR
- [ ] **v0.1** Seed the database with the 50–100 most requested apps
- [ ] **v0.2** Static search site on GitHub Pages
- [ ] **v0.2** Issue templates (compatibility report, add-an-app) and `good first issue` backlog
- [ ] **v0.3** Published packages: `npm` and `PyPI` with a typed API
- [ ] **v0.3** Public announcement (r/linux, Lemmy, distro forums)
- [ ] **v1.0** 20+ outside contributors, stable schema, "Coming from Windows?" widget for distros and themes

## 🏗️ Architecture at a glance

```
data/       ← the source of truth (YAML, one file per app / alternative / report)
schema/     ← JSON Schema that every file must pass
tools/      ← validate + build scripts (YAML → dist/*.json)
site/       ← static search website
packages/   ← npm and PyPI wrappers around the built data
```

Read the [full proposal](docs/ARCHITECTURE.md) for the data model, build pipeline, versioning and governance.

## 📜 License

License is to be finalised before the first release. The proposal is **MIT for code** and **CC0 or CC BY-SA 4.0 for data**. See the [architecture doc](docs/ARCHITECTURE.md#licensing).

---

<div align="center">
Made by the community, for everyone who is one app away from switching. ⭐ Star the repo if you want this to exist.
</div>
