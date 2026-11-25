# Data health and source-link checks

The dashboard at `health.html` reads the generated `/api/v1/health.json`. Metrics come from the current YAML catalog and schema categories, including categories with no entries. The review queues identify unverified apps, comparisons without source links, apps without alternatives and incomplete installation metadata.

Verified app entries require `verified_on`, the UTC date of the latest complete independent review. The dashboard shows the latest date and a queue of reviews more than 365 days old, ordered oldest first. Age is measured from UTC midnight on the build date, so a review exactly 365 days old is not yet queued. Older reviews remain verified until a reviewer identifies unsupported claims; age alone does not change data. With no complete reviews, the dashboard says so. Compatibility report dates are also available: the dashboard shows the latest report date and counts reports older than one year. Reachable source pages do not verify feature, migration or package claims, and no check changes `verified` flags or compatibility ratings.

In `/api/v1/health.json`, `review.verification_dates` is `recorded`, `review.latest_verification` is a date or `null`, and `review.verifications_over_one_year_old` contains app ids, names, categories and review dates. Full app API documents preserve `verified_on`; unverified entries omit it. These metrics describe the catalog at build time and update on the next build.

## Run locally

Requires Node.js 20 or newer and the usual development dependencies.

```powershell
npm run check:links
npm run build
```

The checker writes `dist/reports/link-checks.json` and `dist/reports/link-checks.md`. The build reads the JSON before replacing `dist/`, validates it against the current URL inventory and retains the report alongside the generated health API. All reports are generated output and are never committed.

`npm run check` remains offline: validation, tests and a build. Network failures do not affect it.

Options:

```powershell
npm run check:links -- --timeout 10000 --concurrency 4 --retries 1
npm run check:links -- --strict
```

The timeout is per HTTP request in milliseconds (100–30000); concurrency is 1–12, with at most one active URL per origin; retries are 0–2. `--strict` returns a nonzero exit code for confirmed broken or invalid URLs. The default saves findings without failing a build. Data validation, invalid arguments and report-writing failures still return a nonzero exit code.

Use `--output <path.json>` for another report location. Set `LINK_CHECK_REPORT` before building to read that file:

```powershell
$env:LINK_CHECK_REPORT = "D:/reports/link-checks.json"
npm run build
Remove-Item Env:LINK_CHECK_REPORT
```

## Scope and result meanings

URLs are collected from app and alternative homepages, comparison sources, WineHQ references, installation sources and download/AppImage refs. Templates, free-text notes, comments and documentation links are not scanned. Identical URLs are checked once and retain all referring files and fields. Fragments are removed; anchor targets are not checked.

| Result | Meaning |
| --- | --- |
| `ok` | HTTP 2xx without a detected challenge page |
| `redirected` | Reached HTTP 2xx at another URL |
| `broken` | GET confirms HTTP 404 or 410 |
| `blocked` | Authentication/access restriction, detected challenge page, or a non-public network target |
| `temporary` | HTTP 429, HTTP 5xx, or a URL deferred because its origin was rate-limited |
| `timeout` | A request exceeded its time limit |
| `unreachable` | DNS, TLS, connection or redirect failure |
| `invalid` | An invalid HTTP(S) URL or embedded credentials |
| `http_error` | Another HTTP result needing review |

HEAD is used first. GET confirms apparent dead links, handles unsupported HEAD requests and checks short HTML responses for common access challenges. The checker reads at most 8 KiB of a GET body; it does not download full archives, run scripts or install software. Redirects are checked at each hop. Private, loopback and link-local addresses are excluded, including DNS results. No authentication cookies or credentials are sent.

Temporary failures get bounded retries. Long `Retry-After` values are respected by deferring further checks, and a rate-limited origin's remaining URLs are marked as deferred rather than requested immediately. A blocked or unavailable request is not proof that a source has disappeared.

The dashboard accepts only a complete snapshot with the current inventory digest. A changed URL inventory makes an older check outdated; malformed or incomplete reports are invalid. Results older than 14 days are labelled stale. Missing results stay unknown. Snapshot counters are recalculated rather than trusted from the report file.

## Automation

`link-checks.yml` runs weekly on Monday at 06:00 UTC and can also be run manually. It stores JSON, Markdown and the health API as a 30-day artifact, with read-only repository permissions. Reports are available under the workflow run's artifacts.

The existing deployment jobs run a new link check and rebuild before publishing, so the website includes a snapshot from that deployment. The step is best effort: it is limited to 15 minutes and a failure does not block the release, in which case the page shows no snapshot (unknown). The weekly check produces reports; it does not independently publish the website. A Docker-only build does not run network checks and displays an unknown snapshot unless a report is supplied through the build process.

Review confirmed broken links before removing them: a replacement source may be available. Access restrictions and transient failures need a manual check. Actual package-version and installability validation remains separate from HTTP availability.
