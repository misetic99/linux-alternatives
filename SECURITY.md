# Security policy

Thank you for helping keep this project and the people who use it safe.

## What to report

- **Website or tooling vulnerabilities**: for example cross-site scripting, unsafe handling of community text, a way to make the generated install script run something unintended, or a weakness in the build, deploy or Docker setup.
- **Unsafe data**: an entry that contains a malicious or misleading install command, a link that points somewhere harmful, or content that tries to bypass the schema's safe patterns.
- **Supply-chain concerns**: a dependency, GitHub Action or workflow that could be abused.

Ordinary mistakes in the catalog (a wrong rating, a dead link, an outdated package name) are not security issues. Please open a normal issue or pull request for those.

## How to report

Use GitHub's private reporting: **[Report a vulnerability](https://github.com/misetic99/linux-alternatives/security/advisories/new)**. This keeps the details private until a fix is ready. Please include what you found, how to reproduce it, and the impact you expect. Do not open a public issue for a vulnerability.

If private reporting is unavailable for you, open a public issue that says only that you have a security concern and ask for a private channel. Do not include details in it.

## What to expect

This is a volunteer project, so there is no guaranteed response time. We aim to acknowledge a report within a week, keep you updated, fix confirmed problems as quickly as we can, and credit you in the release notes if you wish.

## Scope and supported versions

Only the latest tagged release and the current `main` branch are supported. Please test against those. The public site and API are static files, there are no user accounts, and no personal data is collected.

## Content removal and trademarks

Product names belong to their owners and are used only to identify software. If you represent a vendor or project and believe an entry is factually wrong or misuses a name or mark, open an issue describing the concern. We correct factual errors and respond to good-faith requests promptly.

## Handling of community text

Entries and compatibility reports come from the community, so the site treats them as untrusted: text is rendered with `textContent`, install commands are built only from references that match the schema's safe patterns, downloads are shown as links and never as run-this commands, and the production server sends a strict Content-Security-Policy. If you find a way around any of this, that is exactly what we want to hear about.
