# Self-hosting the website

The site is plain static files (`dist/`), so any web server can host it. The public instance is planned at **https://linux-alternatives.itasel.org**. GitHub Pages keeps working in parallel, so people who are not contributors can browse and search without GitHub.

Pick one option:

| Option | Best for | Needs on the server |
| --- | --- | --- |
| [A. Docker](#option-a-docker) | Simplest, self-contained | Docker + Compose, a TLS reverse proxy |
| [B. Plain nginx + automatic deploys](#option-b-plain-nginx-with-automatic-deploys) | Existing nginx server, deploys on every merge | nginx, SSH access, rsync |

Both use the same config: [`deploy/nginx.conf`](../deploy/nginx.conf) and [`deploy/security-headers.inc`](../deploy/security-headers.inc).

## What the server does

- Serves the website and the JSON API (`/api/v1/...`), nothing else.
- Sends a strict Content-Security-Policy (only same-origin scripts and styles), `nosniff`, no framing.
- `/api/` is read-only (GET/HEAD/OPTIONS) and open to any origin (CORS `*`), so other tools can use the data from a browser.
- Blocks dotfiles, disables directory listings, serves a custom `404.html`, and answers `/healthz` for monitoring.
- Caches the self-hosted font for a month; pages and the API revalidate quickly.
- Canonical links, `sitemap.xml` and `robots.txt` use the build-time `SITE_URL`. It defaults to `https://linux-alternatives.itasel.org`. For another domain: `SITE_URL=https://example.org docker compose -f deploy/docker-compose.yml up -d --build` (Docker) or `SITE_URL=https://example.org npm run build` (plain server).
- No cookies, no tracking, no external requests.

## Step 0: DNS

Create a record for the domain pointing at your server:

```
linux-alternatives.itasel.org.   A      <server IPv4>
linux-alternatives.itasel.org.   AAAA   <server IPv6>     (if you have one)
```

Open ports 80 and 443 on the firewall. Certificates are issued over port 80/443, so the DNS record must resolve before you request one.

## Option A: Docker

On the server:

```bash
git clone https://github.com/misetic99/linux-alternatives.git
cd linux-alternatives
docker compose -f deploy/docker-compose.yml up -d --build
```

This builds the site inside the image (it validates the data first, so a broken dataset never ships) and listens on `127.0.0.1:8080`, which is not reachable from the internet. Put a TLS reverse proxy in front of it.

**Caddy** (automatic HTTPS, easiest). `/etc/caddy/Caddyfile`:

```
linux-alternatives.itasel.org {
    reverse_proxy 127.0.0.1:8080
}
```

```bash
sudo systemctl reload caddy
```

**Or nginx + certbot** as the reverse proxy:

```nginx
server {
    server_name linux-alternatives.itasel.org;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo certbot --nginx -d linux-alternatives.itasel.org
```

**Updating** after new data is merged:

```bash
cd linux-alternatives
git pull
docker compose -f deploy/docker-compose.yml up -d --build
```

## Option B: Plain nginx with automatic deploys

The repository can publish `dist/` to your server through SSH and rsync whenever you push a **version tag** such as `v0.3.0` (job `server` in [`deploy.yml`](../.github/workflows/deploy.yml)). Pushes to `main` build and deploy nothing, so your own server (and GitHub Pages) change only when you cut a release. It is **off by default**.

### 1. Prepare the server (one time)

```bash
# A dedicated user that owns only the web root
sudo adduser --disabled-password --gecos "" deploy
sudo mkdir -p /var/www/linux-alternatives
sudo chown deploy:deploy /var/www/linux-alternatives

# nginx config: copy both files, point `root` at the web root
sudo cp deploy/nginx.conf /etc/nginx/conf.d/linux-alternatives.conf
sudo cp deploy/security-headers.inc /etc/nginx/conf.d/security-headers.inc
sudo sed -i 's#root /usr/share/nginx/html;#root /var/www/linux-alternatives;#' /etc/nginx/conf.d/linux-alternatives.conf
sudo nginx -t && sudo systemctl reload nginx

# HTTPS
sudo certbot --nginx -d linux-alternatives.itasel.org
```

### 2. Create a deploy key

On your own machine (not on the server), a key used for nothing else:

```bash
ssh-keygen -t ed25519 -f la-deploy -C "linux-alternatives deploy" -N ""
ssh-copy-id -i la-deploy.pub deploy@<server>
```

Get the server's host key and **verify its fingerprint** against the server's own (`ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`) before trusting it:

```bash
ssh-keyscan -t ed25519 <server>
```

### 3. Configure GitHub

Repository → Settings → Secrets and variables → Actions.

**Secrets**

| Name | Value |
| --- | --- |
| `DEPLOY_HOST` | Server hostname or IP |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_PATH` | `/var/www/linux-alternatives` (absolute path, at least two segments) |
| `DEPLOY_SSH_KEY` | Contents of the private key file `la-deploy` |
| `DEPLOY_KNOWN_HOSTS` | The verified `ssh-keyscan` line |
| `DEPLOY_PORT` | Optional, defaults to 22 |

**Variable** (Variables tab): `SELF_HOST_DEPLOY` = `true`

Then publish a release by pushing a tag, or run **Actions → Deploy → Run workflow**:

```bash
git tag v0.3.0
git push origin v0.3.0
```

Delete `la-deploy` from your machine afterwards, GitHub keeps the only copy it needs.

The job runs only for tags and manual runs, never on pull requests from forks, so contributors cannot reach the secrets. Host keys are pinned (`StrictHostKeyChecking=yes`). Anyone who can push tags to the repository can trigger a deploy, so keep write access limited and consider protecting `v*` tags in Settings → Rules.

## Verify

```bash
curl -sI https://linux-alternatives.itasel.org/ | head -n 12
curl -s  https://linux-alternatives.itasel.org/api/v1/index.json | head
curl -s  https://linux-alternatives.itasel.org/healthz
```

You should see `Content-Security-Policy` in the headers, JSON from the API and `ok` from `/healthz`.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Page loads, then "Could not load the database" | `/api/` not reachable: wrong `root`, or the deploy did not run. Check `curl .../api/v1/index.json` |
| Page is unstyled or blank, console shows CSP errors | A proxy in front adds its own Content-Security-Policy, or a script/style was added inline. Keep code and styles in separate files |
| Certificate request fails | DNS not resolving yet, or port 80/443 closed |
| The `Own server` job is skipped | Variable `SELF_HOST_DEPLOY` is not `true` (the default) |
| The `GitHub Pages` job fails with “Tag … is not allowed to deploy to github-pages” | Settings → Environments → `github-pages` → Deployment branches and tags: add the tag rule `v*` |
| Nothing runs after a push to `main` | Expected. Only version tags (`v*`) and manual runs build and deploy |
| rsync "Host key verification failed" | `DEPLOY_KNOWN_HOSTS` is missing or does not match the server |

## Rollback

Option A: `git checkout <older-commit> && docker compose -f deploy/docker-compose.yml up -d --build`.
Option B: run **Actions → Deploy → Run workflow** and choose an older tag as the ref, or `git revert` the bad change and push a new tag.
