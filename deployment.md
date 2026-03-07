# Tuldio — Deployment Guide

## Docker Compose — How it works

### What problem does it solve?

Your app has multiple processes: API, crons, PostgreSQL, a web server. In dev, you run them manually. In production, you need them to start together, talk to each other, restart if they crash, and share configuration.

Docker Compose does exactly that — a single YAML file that describes all your services and how they connect.

### Key concepts

**Image** — A snapshot of a filesystem with everything needed to run your app (Node.js, your code, dependencies). Think of it as a `.zip` of a ready-to-run machine. You build an image from a `Dockerfile`.

**Container** — A running instance of an image. Like launching a `.zip` into a lightweight virtual machine. Each service in docker-compose runs as a container.

**Volume** — A persistent folder that survives container restarts. Without a volume, if you restart a container, all data inside is lost. PostgreSQL data and file uploads need volumes.

**Network** — Docker Compose creates a private network where containers reach each other by service name. The API container connects to `postgres:5432` — Docker resolves `postgres` to the right container automatically.

**Multi-stage Dockerfile** — A recipe with multiple build steps. The final image only contains what you need (not build tools, not dev dependencies). This keeps images small.

**Target** — In a multi-stage Dockerfile, a `target` lets you stop at a specific stage. Same Dockerfile produces your `api` image and your `crons` image by targeting different stages.

### How services talk to each other

```yaml
services:
  api:
    environment:
      # "postgres" is the SERVICE NAME — Docker resolves it automatically
      DATABASE_URL: postgresql://tuldio:secret@postgres:5432/tuldio
  postgres:
    image: postgres:16
```

No IP addresses, no localhost — just service names.

### Environment variables

Two approaches:
- **Inline** in `docker-compose.yml`: `environment: { PORT: 3003 }`
- **From a file**: `env_file: .env.production` — keeps secrets out of the YAML

For secrets (API keys, DB password), always use `env_file`.

### Useful commands

```bash
docker compose up -d          # Start all services (detached)
docker compose down            # Stop all services
docker compose logs -f api     # Follow logs of one service
docker compose ps              # See running containers
docker compose restart api     # Restart one service
docker compose up -d --build   # Rebuild images + restart (deploy)
docker compose exec api sh     # Open a shell inside a container
docker compose exec postgres psql -U tuldio  # Open psql
```

---

## Architecture

```
VPS (Scaleway START-2-S — 2 vCPU, 2GB RAM, Paris)
├── Docker Compose
│   ├── caddy      (reverse proxy + auto SSL + serves web SPA)
│   ├── api        (Express + Puppeteer for PDFs)
│   ├── crons      (scheduled jobs)
│   └── postgres   (database)
├── Volumes
│   ├── pgdata     (PostgreSQL data, persists across restarts)
│   ├── files      (PDFs, receipts, uploaded documents)
│   ├── caddy-data (SSL certificates)
│   └── caddy-config
```

### Request flow

```
User (tuldio.fr)
    │
    ▼
  Caddy (:80/:443, auto SSL)
    ├── /api/*    → reverse proxy → api:3003 (Express)
    ├── /files/*  → reverse proxy → api:3003 (static files)
    └── /*        → serve /srv/web (React SPA, fallback to index.html)
```

---

## Files overview

### `Dockerfile` — Multi-stage build

```
Stage 1: base       → Node 22 + pnpm
Stage 2: deps       → pnpm install (cached if package.json unchanged)
Stage 3: source     → copy all source code
Stage 4: web-build  → vite build → static HTML/JS/CSS
Stage 5: api        → Express + Chromium (for Puppeteer PDF generation)
Stage 6: crons      → scheduled jobs (lightweight, no Chromium)
Stage 7: caddy      → Caddy + web static files copied from web-build
```

Docker caches each stage. If you only change source code (not dependencies), stages 1-2 are cached and the build is fast.

### `docker-compose.yml` — 4 services

| Service | Image | Purpose |
|---------|-------|---------|
| `postgres` | `postgres:16-alpine` | Database, data in `pgdata` volume |
| `api` | Built from Dockerfile `api` target | Express API, runs migrations on startup |
| `crons` | Built from Dockerfile `crons` target | Scheduled jobs |
| `caddy` | Built from Dockerfile `caddy` target | Auto SSL, serves SPA, proxies API |

### `Caddyfile` — Reverse proxy config

Caddy handles:
- Automatic HTTPS (Let's Encrypt certificates, auto-renewed)
- Routing `/api/*` and `/files/*` to Express
- Serving the React SPA with fallback to `index.html` for client-side routing

### `.env.production.example` — Template for secrets

Copy this to `.env.production` and fill in real values. Never commit `.env.production`.

---

## First deployment (step by step)

### 1. Prepare the VPS

```bash
# SSH into your VPS
ssh root@YOUR_VPS_IP

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose plugin (included with modern Docker)
docker compose version  # should print v2.x

# Install Git
apt install -y git
```

### 2. Point your domain

In your DNS manager (where you bought tuldio.fr), add:

```
A    tuldio.fr       → YOUR_VPS_IP
A    www.tuldio.fr   → YOUR_VPS_IP
```

Wait for DNS propagation (usually 5-15 minutes).

### 3. Clone and configure

```bash
# Clone your repo
git clone https://github.com/YOUR_USER/tuldio.git /opt/tuldio
cd /opt/tuldio

# Create production env file
cp .env.production.example .env.production
nano .env.production
```

Fill in real values:
- `DOMAIN=tuldio.fr`
- `POSTGRES_PASSWORD=` (generate a strong random password)
- `JWT_SECRET=` (generate a random 64-char string)
- `ANTHROPIC_API_KEY=` (your Claude API key)
- `RESEND_API_KEY=` (your Resend key)
- `CORS_ORIGIN=https://tuldio.fr`

Tip — generate random strings:
```bash
openssl rand -hex 32   # 64-char random string
```

### 4. Build and start

```bash
docker compose up -d --build
```

First build takes 3-5 minutes (downloading Node, Chromium, dependencies). Subsequent builds are faster thanks to Docker cache.

### 5. Verify

```bash
# Check all 4 services are running
docker compose ps

# Check API logs
docker compose logs -f api

# Check Caddy got the SSL certificate
docker compose logs caddy

# Test the API
curl https://tuldio.fr/api/health
# → {"data":{"ok":true}}
```

---

## Redeployment (after code changes)

```bash
ssh root@YOUR_VPS_IP
cd /opt/tuldio
git pull
docker compose up -d --build
```

That's it. Docker rebuilds only what changed, restarts the affected containers.

---

## Database operations

### Access psql

```bash
docker compose exec postgres psql -U tuldio
```

### Manual backup

```bash
docker compose exec postgres pg_dump -U tuldio tuldio > backup_$(date +%Y%m%d).sql
```

### Restore from backup

```bash
cat backup_20260307.sql | docker compose exec -T postgres psql -U tuldio tuldio
```

### Automated daily backup (optional)

Add a cron on the VPS itself (not in the app):

```bash
crontab -e
```

```
0 3 * * * cd /opt/tuldio && docker compose exec -T postgres pg_dump -U tuldio tuldio | gzip > /opt/backups/tuldio_$(date +\%Y\%m\%d).sql.gz
```

---

## Monitoring

### Check logs

```bash
docker compose logs -f           # All services
docker compose logs -f api       # API only
docker compose logs -f postgres  # Database only
```

### Check resource usage

```bash
docker stats   # Live CPU/RAM per container
```

### Restart a crashed service

```bash
docker compose restart api
```

Docker `restart: unless-stopped` means containers auto-restart on crash. You only need manual restart if you want to force it.

---

## Upgrade path

| When | Do |
|------|-----|
| Need more RAM | Upgrade Scaleway VPS (click in dashboard, reboot) |
| Want managed DB backups | Move Postgres to Neon or Scaleway Managed DB, update `DATABASE_URL` |
| Need zero-downtime deploys | Add a second VPS + load balancer, or switch to Coolify |
| Need S3 file storage | Switch `FILES_DIR` to Scaleway Object Storage, update upload logic |

For now, this setup handles 100+ clients without breaking a sweat.

---

## Post-deploy security checklist

Do this right after your first successful deploy. Takes ~15 minutes total.

### 1. Firewall (2 minutes)

Only allow web traffic and SSH. Block everything else.

```bash
# Install UFW (Uncomplicated Firewall)
apt install -y ufw

# Allow SSH (IMPORTANT: do this BEFORE enabling, or you lock yourself out)
ufw allow 22/tcp

# Allow HTTP and HTTPS (for Caddy)
ufw allow 80/tcp
ufw allow 443/tcp

# Enable the firewall
ufw enable

# Verify
ufw status
# Should show:
# 22/tcp   ALLOW  Anywhere
# 80/tcp   ALLOW  Anywhere
# 443/tcp  ALLOW  Anywhere
```

Why: without a firewall, anyone can probe every port on your VPS. PostgreSQL (5432) would be exposed to the internet. UFW blocks everything except what you explicitly allow.

### 2. SSH key authentication (10 minutes)

Disable password login — only allow SSH keys. This blocks brute-force attacks.

**On your Mac (local machine):**

```bash
# Generate a key pair if you don't have one already
ls ~/.ssh/id_ed25519.pub 2>/dev/null || ssh-keygen -t ed25519

# Copy your public key to the VPS
ssh-copy-id root@YOUR_VPS_IP
```

**Test it works — open a NEW terminal and SSH in:**

```bash
ssh root@YOUR_VPS_IP
# Should connect WITHOUT asking for a password
```

IMPORTANT: do NOT close your current SSH session until you've confirmed the key works in a new terminal. If you misconfigure and close your session, you're locked out.

**On the VPS, disable password login:**

```bash
nano /etc/ssh/sshd_config
```

Find and change these lines:

```
PasswordAuthentication no
PubkeyAuthentication yes
```

Restart SSH:

```bash
systemctl restart sshd
```

**Verify in another new terminal:**

```bash
ssh root@YOUR_VPS_IP
# Should still work with your key
```

Why: bots constantly try to brute-force SSH passwords. With key-only auth, they can't get in even if they guess "root/password123".

### 3. Automated daily backups (5 minutes)

Create the backup directory:

```bash
mkdir -p /opt/backups
```

Add a daily cron job:

```bash
crontab -e
```

Add this line at the bottom:

```
0 3 * * * cd /opt/tuldio && docker compose exec -T postgres pg_dump -U tuldio tuldio | gzip > /opt/backups/tuldio_$(date +\%Y\%m\%d).sql.gz && find /opt/backups -name "*.sql.gz" -mtime +30 -delete
```

What this does:
- Every day at 3:00 AM, dumps the database to a compressed file
- Deletes backups older than 30 days (so disk doesn't fill up)
- Files are named `tuldio_20260307.sql.gz`

Verify it works manually:

```bash
cd /opt/tuldio && docker compose exec -T postgres pg_dump -U tuldio tuldio | gzip > /opt/backups/tuldio_test.sql.gz
ls -lh /opt/backups/
# Should see the file with a reasonable size
rm /opt/backups/tuldio_test.sql.gz
```

To restore from a backup:

```bash
gunzip -c /opt/backups/tuldio_20260307.sql.gz | docker compose exec -T postgres psql -U tuldio tuldio
```

### 4. Unattended security updates (2 minutes)

Keep the OS patched automatically:

```bash
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
# Select "Yes"
```

This auto-installs security patches for Ubuntu. Your app containers are unaffected — only the host OS gets patched.

---

## Full checklist — copy/paste after deploy

```
[ ] docker compose ps → all 4 services running
[ ] curl https://tuldio.fr/api/health → {"data":{"ok":true}}
[ ] ufw enabled, ports 22/80/443 only
[ ] SSH key auth works, password login disabled
[ ] Daily backup cron added
[ ] Unattended upgrades enabled
[ ] .env.production has strong POSTGRES_PASSWORD and JWT_SECRET (openssl rand -hex 32)
```

Once all boxes are checked, you're production-ready.
