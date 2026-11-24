# Roadmap

Status as of **24 November 2026**. This is the single source of truth for the plan. The README, the architecture document and the website's “Ideas” page summarise it. Dates are deliberately absent: milestones are done when their exit criteria are met, not when a calendar says so.

**Guiding idea: trust before reach.** A database of guesses is worse than no database. We grow the audience only after the data deserves it.

## 1. Where we are

**Built**

| Area | State |
| --- | --- |
| Foundation | Data model, JSON Schemas, validation, build, CI on every pull request |
| Website | Search, app details and reports, switch planner, project pages, strict security headers |
| JSON API | Static, versioned, open CORS under `/api/v1/` |
| Install data | Sourced, per-distribution install routes for all alternatives (13 methods, from `apt` to `nix`, plus Flatpak, Snap, AppImage and project downloads) |
| Hosting | GitHub Pages on `main`, own server (Docker, nginx, rsync) on version tags |
| Governance basics | MIT + CC0, contributing guide, code of conduct, issue and PR templates |
| Data health | Generated dashboard with category coverage, review queues and dated source-link snapshots; weekly reports and checks before deployment |

**The data, honestly**

| Metric | Now | Comment |
| --- | --- | --- |
| Windows apps | 100 | Seeds from general knowledge with source links |
| Linux alternatives | 41 | All with sourced install routes |
| **Verified entries** | **0** | Every entry is still `verified: false` |
| **Compatibility reports** | **0** | Every app shows “untested” |
| Outside contributors | 0 | |

| Category | Apps | |
| --- | --- | --- |
| graphics | 29 | |
| utilities | 23 | |
| video | 18 | |
| development | 10 | |
| office | 9 | |
| cad | 5 | |
| audio | 4 | thin |
| engineering | 1 | thin |
| accounting | 1 | thin |
| printing | 0 | **missing** |

## 2. What the numbers tell us

1. **Credibility gap.** Nothing is verified and there are no reports. Announcing now would invite “this is all guesswork”, and a bad first impression is hard to undo.
2. **Coverage skew.** Graphics, utilities and video are 70 of 100 apps. The niche that motivated the project (CAD, engineering, accounting, printing) has 7 apps in total, and printing none. That niche is also where open sources of truth are scarcest, so it is where we are most valuable.
3. **Unused data.** Every alternative has rich per-distribution install routes, but the planner still only uses Flatpak.
4. **Process gaps.** Weekly source-link checks and a data health dashboard are implemented. Code owners, a security policy, compatibility-report automation and verification dates are still missing.

## 3. How we prioritise

1. **Trust over reach.** Verified data and real reports come before announcements.
2. **Depth in the professional niche over breadth in consumer tools.**
3. **Automate what reviewers repeat.** If a human leaves the same comment twice, a check should leave it instead.
4. **Stay static and private.** No backend, no accounts, no tracking. Features that need one are redesigned or dropped.
5. **Never invent facts.** Unknown stays unknown.

## 4. Milestones

### v0.3 Trust (next)

**Goal:** the database is believable enough to announce.

**Exit criteria**

- At least **25 apps verified**, each checked by someone other than the author.
- At least **10 compatibility reports** from at least **3 different reporters**.
- At least **5 apps in each** of `cad`, `engineering`, `accounting`, `printing` and `audio`.
- Scheduled link check passes; no known dead source links.
- `SECURITY.md`, `CODEOWNERS` and protection for `main` and `v*` tags in place.

**Work**

| Item | Notes |
| --- | --- |
| Verification policy | Define what `verified: true` means (every claim checked against a cited source or by testing) and require a second reviewer. Decide whether to add `verified_on` (date) to the schema so freshness can be measured |
| Verification sprint | Start with the most-searched apps. One category per sprint |
| Seed the professional niche | Candidates to investigate, not claims: Revit, Rhino, ArchiCAD, LTspice, ANSYS, Sage 50, Tally, BarTender, NiceLabel, large-format and label printing tools |
| First compatibility reports | Ask people who already run Windows apps on Linux. Start with apps that have known Wine users |
| Link and freshness checker | HTTP link checks, weekly report artifacts and deployment snapshots are implemented. Verification-age tracking and issue automation remain planned; blocked and temporary requests require separate review |
| Contributor on-ramp | A script that turns unverified entries into well-described `good first issue` texts. Issue-form to pull-request automation for reports, so non-Git users can contribute |
| Repository hygiene | `SECURITY.md`, Dependabot for GitHub Actions and npm, `CODEOWNERS`, labels (`good first issue`, `new-app`, `report`, `verification`), branch and tag protection |

### v0.4 Planner 2.0

**Goal:** turn the install data we already have into a better migration plan.

- **Distribution-aware plan.** Pick a distribution (kept in the URL hash with the apps) and prefer native packages or Flatpak. Show only routes with sourced availability for that distribution, and say plainly when none is known. Commands are built only from refs that pass the schema’s safe pattern, `download` and `appimage` stay links, and nothing ever downloads and runs.
- **More exports.** Shell script, Markdown checklist, JSON, and a print-friendly view.
- **Team assessment.** Paste the output of `winget list` or an installed-programs export and match it locally against app names and aliases. Unmatched programs become “help add this app” links. Nothing leaves the browser.
- **Data health page (implemented).** Category coverage, verified share, source gaps, apps without alternatives and dated link checks. Generated at build time; verification age remains unknown until verification dates are recorded.
- **Compare view.** Two alternatives side by side: fit, formats, missing features, install routes.

**Exit criteria:** distribution-aware plans for at least the ten most common distributions in the data; the team assessment handles a real `winget list` export; the new code has unit tests like the rest.

### v0.5 Distribution

**Goal:** other projects can depend on the data without scraping.

- **Packages.** Typed `npm` and `PyPI` packages generated from `dist/`, published by the release workflow when a version tag is pushed (maintainer-provided tokens, provenance enabled).
- **API polish.** JSON Schema for the API output, a changelog for the data, a CSV export and an Atom “what’s new” feed generated from the data.
- **Citable releases.** Tagged data releases with a DOI (for example through Zenodo) so reports and papers can cite a specific version.

**Exit criteria:** one external project consumes a package or the API; breaking changes follow the versioning policy.

### v0.6 Reach

**Goal:** go public, once v0.3 is true.

- **Public announcement** on r/linux, Lemmy and distribution forums. Preconditions: the v0.3 exit criteria, a working demo, and honest framing (“early, community-built, here is how to help”).
- **Translations.** Interface and guidance in more languages; Croatian is a natural first candidate.
- **“Coming from Windows?” widget** for distributions, themes and onboarding apps, built from the same JSON.
- **Browser extension** that shows Linux alternatives on a Windows app’s download page, offline-first and without tracking.

### v1.0 Stable

All of the following, held for a few months:

| Criterion | Target |
| --- | --- |
| Schema | Stable; breaking changes only with a new `/api/v2/` |
| Coverage | 150+ apps across all categories, with the professional niche represented |
| Quality | At least half of the entries verified |
| Reports | 50+ compatibility reports |
| Community | 20+ outside contributors |
| Adoption | At least 2 downstream consumers |
| Governance | Documented maintainers, review rules and release process |

## 5. Tracks that run throughout

| Track | What it means |
| --- | --- |
| **Data quality** | Verification, freshness, neutral wording, no copied text |
| **Community** | Friendly reviews, quick feedback, visible credit, a steady supply of small tasks |
| **Tooling and infrastructure** | Fast CI, tested tools, reproducible builds, simple self-hosting |
| **Security and privacy** | Strict CSP, no third-party scripts, safe handling of community text, supply-chain care when publishing packages |
| **Sustainability** | Hosting stays cheap (static files), more than one maintainer, a way to fund hosting and review time if the project grows |

## 6. Metrics we watch

| Metric | Now | v0.3 target | v1.0 target |
| --- | --- | --- | --- |
| Apps | 100 | 120+ | 150+ |
| Verified share | 0% | 25+ apps | 50%+ |
| Compatibility reports | 0 | 10+ | 50+ |
| Categories with 5+ apps | 6 of 10 | 10 of 10 | 10 of 10 |
| Outside contributors | 0 | 3+ | 20+ |
| Dead source links | unknown | 0 | 0 |
| Downstream consumers | 0 | 0 | 2+ |

## 7. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Wrong data harms trust | `verified` flag, visible “unverified” labels, second-reviewer rule, “untested” instead of guessing |
| Entries go stale | Scheduled link and freshness checks, `verified_on` date, packages and releases show data age |
| Vendor or trademark complaints | Product names used descriptively, clear disclaimer, quick takedown path in `SECURITY.md` or contact docs |
| Maintainer bandwidth | `CODEOWNERS` per category, automation for repetitive review, small focused pull requests |
| Low-quality or promotional pull requests | Neutral-wording rules, templates, CI checks, “verify or cite” |
| Manipulated compatibility reports | Reports carry reporter handle, versions and date; the headline status is derived from many reports, not typed |
| Supply-chain attack through packages | Release only from tags, minimal tokens, provenance, protected tags, Dependabot |
| Install data rots as repositories change | Package availability checks against repositories, sourced per distribution, “unknown” instead of “unsupported” |

## 8. Open questions

1. **Release naming.** Version tags (`v0.3.0`) drive deploys today. Should data releases use CalVer (`v2026.12.0`) instead, as the architecture note suggests, or keep semver for tooling and CalVer for data packages?
2. **Verification rule.** Is a single independent reviewer enough, or do some categories (for example accounting) need a domain expert?
3. **Anonymous reports.** Do we accept compatibility reports without a GitHub identity?
4. **External sources.** May we link to or import from WineHQ AppDB or ProtonDB, and under what terms?
5. **Project name and organisation.** The repository is still `linux-alternatives` under a personal account.
6. **Funding.** Hosting is cheap. Do we want sponsorship for review time, and through which channel?

## 9. How to influence the plan

Open an issue with your idea or objection, or send a pull request against this file. The roadmap changes when someone makes a good argument, not when someone shouts the loudest.
