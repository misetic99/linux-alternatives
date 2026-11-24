# Contributing

Thanks for helping! Most contributions are a single small YAML file. You do not need to write code.

## Ways to contribute

| I want to... | Do this |
| --- | --- |
| Add a Windows app | Copy `data/apps/_template.yaml` to `data/apps/<app-id>.yaml` |
| Add a Linux alternative | Copy `data/alternatives/_template.yaml` to `data/alternatives/<id>.yaml` |
| Report that an app runs (or not) | Open a *Compatibility report* issue, or copy `data/reports/_template.yaml` to `data/reports/<app-id>/<name>.yaml` |
| Fix wrong information | Edit the file and open a PR, linking a source |
| Improve tooling | See [Development](#development) |

## Adding an app step by step

1. Fork the repo and create a branch.
2. Make sure each alternative you reference exists in `data/alternatives/`. Add it first if not.
3. Copy the template and fill it in. The file name must equal the `id` (`adobe-photoshop.yaml`, `id: adobe-photoshop`).
4. Run `npm install` once, then `npm run validate`.
5. Open a PR. One app per PR keeps review quick.

### The `fit` rating

| Value | Meaning |
| --- | --- |
| `full` | Covers essentially everything a typical user of the Windows app does |
| `good` | Covers the common workflows; gaps only in advanced features |
| `partial` | Usable for some tasks; important features or formats are missing |
| `minimal` | Only covers a small part of what the Windows app does |

### The compatibility `status`

Same vocabulary as WineHQ and ProtonDB: `platinum` (perfect out of the box), `gold` (perfect after tweaks), `silver` (minor issues), `bronze` (major issues), `borked` (does not run). An app's headline status is derived from its reports at build time. Do not set it by hand.

## Data rules

- **Verify or cite.** Only add what you tested or can link to a source. Unsure? Leave `verified: false`.
- **Stay neutral.** Describe features, do not advertise. No "best", "amazing", or "X sucks".
- **Be concrete.** "Cannot export DWG" beats "poor compatibility".
- **Use your own words.** Do not paste text from other databases or vendor marketing pages.
- **Slugs.** Lowercase, hyphens only, no version numbers in app ids (`autocad`, not `autocad-2024`; put the version in reports).

## Installation availability

Each alternative lists installation routes with `method` and `ref`. Add `distros`, `sources` and a short `notes` field to every route. Native package availability must come from that distribution's repository or the project's installation guide. Do not infer Ubuntu availability from Debian, RHEL availability from Fedora, or derivative availability from Arch.

Use distribution ids from `schema/alternative.schema.json`. `any` means a distribution-independent runtime or project download, with prerequisites explained in `notes`; it does not mean the vendor tested every distribution. `live` is for bootable media that runs separately from the installed system. State release, repository and architecture restrictions where known. Missing availability is unknown, not unsupported.

Supported package managers are `apt`, `dnf`, `pacman`, `zypper`, `apk`, `xbps`, `eopkg`, `emerge` and `nix`, plus `flatpak` and `snap`. Package refs must pass the schema's safe pattern. Only Portage atoms allow a single category/name slash. Set `classic: true` only for Snap packages whose store entry requires classic confinement. `download` and `appimage` refs must be HTTP(S) URLs; the site renders them as links and never assembles download-and-run commands.

The metadata fields are optional and all previously committed entries remain valid. This catalog supplies the metadata for every route. AppImage refs now use HTTP(S) URLs; there were no AppImage refs in the previous catalog. External entries using a bare AppImage filename must migrate to a project download URL. Fit ratings and installation availability are separate from tested Wine/Proton reports.

## Development

Requires Node.js 20 or newer.

```bash
npm install
npm run validate   # check data/ against schema/ and cross-file rules
npm test           # unit tests for the tooling
npm run build      # generate dist/ (website + api/v1/*.json), never committed
npm run dev        # build, then preview the website at http://localhost:4173
npm run check      # validate + test + build
```

Layout: `data/` (the database), `schema/` (JSON Schemas), `tools/` (validate and build), `site/` (the website), `docs/` (architecture).

Website rules:

- Render community data with `textContent`, never `innerHTML`.
- Only build install commands or script lines from refs that match the safe pattern in `schema/alternative.schema.json`, and strip control characters from names before they go into a script (see `site/plan-core.js`).
- No inline `<script>`, `style=""` attributes or event-handler attributes, and no third-party resources: the production server sends a strict Content-Security-Policy. A test enforces this.
- Pages share `site/partials/header.html` and `footer.html`. Put `<!--@header-->`, `<!--@footer-->` and `{{canonical}}` in a page, and set `<body data-page="name">` so the matching nav link is highlighted.
- Keep logic that can be tested out of the DOM code (see `plan-core.js` and `tools/*.test.mjs`).
Schema changes need a note in the PR on how existing data is affected.

## Licensing

Code is MIT and data is CC0. See [docs/LICENSING.md](docs/LICENSING.md). By opening a PR you agree to these terms.

## Conduct

Be kind and assume good faith. See [docs/CODE_OF_CONDUCT.md](docs/CODE_OF_CONDUCT.md).
