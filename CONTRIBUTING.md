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

## Development

Requires Node.js 20 or newer.

```bash
npm install
npm run validate   # check data/ against schema/ and cross-file rules
npm test           # unit tests for the tooling
npm run build      # generate dist/api/v1/*.json (never committed)
npm run check      # all of the above
```

Layout: `data/` (the database), `schema/` (JSON Schemas), `tools/` (validate and build), `docs/` (architecture).
Schema changes need a note in the PR on how existing data is affected.

## Licensing

Code is MIT and data is CC0. See [LICENSING.md](LICENSING.md). By opening a PR you agree to these terms.

## Conduct

Be kind and assume good faith. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
