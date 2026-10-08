# Math Notes — setup, deployment & operations

Handwritten math notebooks in the browser, built for a Samsung tablet + S Pen.

```
frontend/   React + Vite + TS — library dashboard and the ink editor (GitHub Pages)
backend/    Node 22 + Fastify + postgres.js — REST API (Docker on the Raspberry Pi)
deploy/     docker-compose + deploy script for the Pi, k8s Service exposing the shared Postgres
.github/    Manual deploy workflows: Pi (self-hosted runner) and GitHub Pages
```

## Input model

| Input | Does |
| --- | --- |
| S Pen | Draws with the selected tool (pressure-sensitive) |
| S Pen **holding the side button** | Stroke eraser (also: stylus eraser ends, right mouse button) |
| One finger | Scroll (with momentum) — fingers never draw (palm rejection) |
| Two fingers | Pinch zoom |
| Ctrl + wheel / trackpad pinch | Zoom on desktop |
| Ctrl+Z / Ctrl+Shift+Z | Undo / redo |

Strokes are stored per page as vectors in a fixed 1000×1414 page coordinate space
(`points` is a flat `[x, y, pressure, …]` array) and rendered with
[perfect-freehand](https://github.com/steveruizok/perfect-freehand). Pages autosave ~0.7s after the last stroke.

## Local development

```bash
# DB: tunnel to the Pi's Postgres (ClusterIP of fc26/postgres-shared)
ssh -N -L 15432:10.43.103.19:5432 raspberry

cd backend && cp .env.example .env   # set DATABASE_URL=postgres://mathnotes:<pw>@localhost:15432/mathnotes
npm install && npm run dev           # http://localhost:3000, runs migrations on start

cd frontend && npm install && npm run dev   # http://localhost:5173 (also on LAN for testing on the tablet)
```

To try the pen on the tablet during development, open `http://<pc-ip>:5173` and add that origin to
`CORS_ORIGINS` and `VITE_API_URL=http://<pc-ip>:3000` in `frontend/.env.local`.

## Login

Single admin, password only. `POST /api/auth/login` returns an HS256 JWT valid for **14 days**; every
other `/api` route (except `/api/health`) requires `Authorization: Bearer <token>`.

- The password is stored only as an scrypt hash (`ADMIN_PASSWORD_HASH`); the generated password is on
  the Pi in `~/mathnotes/.adminpass` → `ssh raspberry cat ~/mathnotes/.adminpass`.
- **Lockout:** after `LOGIN_MAX_ATTEMPTS` (5) wrong passwords in a row the login locks, even for the
  correct password, for `LOGIN_LOCK_MINUTES` (15; `0` = until unlocked manually). A successful login
  resets the counter. State lives in the `auth_state` table, so restarts don't reset it.
- **Unlock manually:**
  `ssh raspberry 'KUBECONFIG=~/.kube/config kubectl -n fc26 exec postgres-0 -- psql -U mathnotes -d mathnotes -c "UPDATE auth_state SET failed_attempts=0, locked_at=NULL"'`
- **Change the password:** `docker exec mathnotes-api node dist/scripts/hash-password.js 'new password'`
  (or `npm run hash-password` locally), put the hash into `~/mathnotes/.env`, then `./deploy/deploy-pi.sh`.
- **Log out all devices:** change `JWT_SECRET`.

## Database

Reuses the Postgres 17 instance running in k3s (`fc26/postgres-0`) with its own role and database
`mathnotes` — nothing else is shared. The DB password lives on the Pi in `~/mathnotes/.dbpass`; the
backend's env file is `~/mathnotes/.env`. Migrations are plain SQL files in `backend/migrations/`,
applied in order on startup and tracked in `schema_migrations`.

Imported PDF pages: the browser rasterises each chosen PDF page (pdf.js, 1800px wide JPEG) and uploads it as
the page's background (`page_backgrounds`, one row per page, deleted with the page). The original PDF
is not stored. `POST /api/notebooks/:id/pages?position=N&width=&height=` with an image body inserts such a
page at position N; `GET /api/pages/:id/background` returns the image.

## Deployment

All deploys are **manual**.

| Part | Where | URL |
| --- | --- | --- |
| Frontend | GitHub Pages | https://notes.malisi.ch (CNAME → `yeagercs.github.io` at Hostpoint) |
| Backend | Docker on the Raspberry Pi (`mathnotes-api`, host port 3100) | https://api.malisi.ch |

### Backend → Raspberry Pi

From your PC (Git Bash):

```bash
./deploy/deploy-pi.sh
```

It uploads the sources over `ssh raspberry`, builds the arm64 image on the Pi, restarts the container
via `deploy/docker-compose.yml` and health-checks it on port 3100.

Or **Actions → "Deploy backend to Raspberry Pi" → Run workflow** (needs a self-hosted runner on the Pi
with the label `mathnotes`).

How `https://api.malisi.ch` reaches the container:

- DNS: `api` CNAME → `malisi.duckdns.org` (DuckDNS updater runs on the Pi).
- Nginx Proxy Manager proxy host `api.malisi.ch` → `http://mathnotes-api:3000` with a Let's Encrypt cert
  (the container is attached to `nginxnpm_default`).
- Note: k3s Traefik also claims port 443 on the Pi and wins over Docker for outside traffic, so HTTPS has
  to be routed to NPM explicitly (extra NPM port mapping + router forward).
- `CORS_ORIGINS` in `~/mathnotes/.env` must contain `https://notes.malisi.ch`.

### Frontend → GitHub Pages

**Actions → "Deploy frontend to GitHub Pages" → Run workflow.** Repository variables
(Settings → Secrets and variables → Actions → Variables):

- `VITE_API_URL` = `https://api.malisi.ch` (must include `https://`, no trailing slash)
- `VITE_BASE` — leave unset (custom domain serves from `/`)

## Roadmap

- [ ] Single-admin login (hook point: `backend/src/app.ts`)
- [ ] Rename notebook from inside the editor, page reordering
- [ ] Lasso select / move, partial (pixel) eraser
- [ ] Offline queue for saves
