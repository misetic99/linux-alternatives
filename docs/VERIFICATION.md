# Reviewing catalog entries

`verified: true` means every claim in that app entry has supporting evidence and a reviewer other than the change author has checked it. It is not a claim that every workflow works, a vendor endorsement, or a substitute for version-specific Wine/Proton reports. New entries and incomplete reviews stay `verified: false`.

## Pick a task

The [Data health page](https://linux-alternatives.itasel.org/health.html) lists unverified entries and comparisons without sources. Start with an app or workflow you know. A correction to one claim is useful; a first contribution does not need to verify an entire entry.

For maintainers, the local generator turns the current unverified entries into reviewable issue drafts:

```powershell
npm run tasks:verification
npm run tasks:verification -- --category cad --limit 5
npm run tasks:verification -- --app autocad
```

It writes `dist/review/verification.md` and `dist/review/verification.json`. Each run replaces both files with the selected tasks. `--app` takes an exact app id, `--category` takes a schema category, and `--limit` takes a positive integer. Filters combine, then the limit applies. Unknown ids, invalid categories, repeated flags and invalid limits fail without overwriting the previous drafts. A verified app or an empty category produces an empty selection.

Professional categories (`cad`, `engineering`, `accounting`, `printing`, `audio`) come first, ordered by the number of catalog apps in the category, then category and app id. Other categories sort by category and app id. Counts include verified entries. This is coverage ordering, not a popularity or difficulty score; there are no tasks for categories without apps.

The Markdown contains each issue title and body. The JSON separates `title`, `labels` and `body`, alongside selection counts and filters. Drafts include the current app claims, source gaps, shared alternative files, installation metadata and report file references. They contain no prefilled review evidence. Installation refs are context, not runnable scripts.

Review a draft before copying it into an issue. `verification` and `good first issue` are suggested labels; a maintainer must create or choose available labels. The command makes no network requests, opens no issues, stages no files and never changes catalog data. Generated drafts are not committed and can go stale: regenerate after edits. `npm run build`, `npm run check` and `npm run dev` regenerate `dist/`, so run the generator after those commands when you need to keep the drafts for review.

Contributors without a local checkout can use the [Verify an entry issue form](https://github.com/misetic99/linux-alternatives/issues/new?template=verify-entry.yml). A maintainer can turn the evidence into a focused pull request. The form does not verify the entry automatically.

## Gather evidence

1. Confirm the app identity, aliases, vendor, category and official homepage.
2. Check each alternative comparison: the workflows behind its fit rating, separate import and export claims, shortcut similarity, missing features and notes. File-extension recognition alone does not establish round-trip fidelity. Fit is a judgement: explain the workflows and limits that justify it.
3. Cite direct documentation or reproducible tests for each claim. Use comparison `sources` for relevant evidence URLs and `notes` for concise limitations. Describe tests in the pull request, with app and alternative versions, relevant distribution and architecture, steps, date and observed result. Do not upload private or proprietary sample files.
4. Check related shared alternative metadata and the cited installation routes. Preserve release, repository, architecture and runtime restrictions. A package page or reachable URL does not prove successful installation; an unlisted distribution is unknown. Correct shared alternative data in its own file and explain the effect on other apps.
5. Keep Wine/Proton results separate. An actual compatibility test belongs in `data/reports/<app-id>/` with versions, environment, reporter and date. Existing reports establish only what their recorded environment and workflow tested. No reports means untested, even when a native alternative works.

Use neutral wording and your own descriptions. Link to supporting facts rather than copying text from WineHQ AppDB, ProtonDB, AlternativeTo or vendor pages. Remove or qualify unsupported claims instead of filling gaps with guesses.

## Review and merge

Keep the entry unverified while gathering evidence. Run `npm run check` and open a focused pull request containing the corrections and evidence. The change author must not be the only reviewer of a change that marks the entry verified.

An independent reviewer checks the complete app entry against the evidence, records the review date, scope and outcome in the pull request, and requests corrections where evidence is incomplete. Once that review supports every remaining claim, the maintainer can set `verified: true`. Partial reviews and unrelated fixes retain `verified: false`; if a later substantive edit invalidates the supporting evidence, return the entry to `verified: false` until it is reviewed again.

The schema currently records only the flag, not a verification date or reviewer identity. The review record stays in the pull request; the health dashboard continues to label verification age unknown. Validators check structure and references, not the truth of claims or reviewer independence. Verification-date fields and automated report-to-pull-request conversion remain separate roadmap work.
