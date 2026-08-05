# Careers + Panel — complete production config & deploy

**Production is the VPS + Vercel. Local Mac `.env` files affect NOTHING in production** — they only
matter if you run a dev server. Everything below is the real landscape, verified on 2026-08-05, not
a delta.

---

## 1. Where each piece actually runs

| Piece | Runs where | Path / detail |
|---|---|---|
| `flocci.in` (landing SPA) | **Vercel** | repo `flocci-official-landing-page` |
| `apis.flocci.in` (careers API) | **Vercel** | repo `flocci-backend` |
| `panel.flocci.in` UI | **VPS**, nginx static | serves `/var/www/flocci/flocci-panel-ui/dist` |
| `panel.flocci.in` API | **VPS**, pm2 | `~/flocci/panel/flocci-panel-srv`, `127.0.0.1:3010` |
| DB `flocci_app_official` | **VPS** Postgres | reached by Vercel via pgbouncer `:6432` |

VPS = `afsar@15.235.166.170` (`vps-fa7a4e55`).
nginx vhost `/etc/nginx/sites-enabled/panel.flocci.in` proxies `/api/`, `/auth/`, `/ws` → `:3010`.
pm2 process name is **`vps-monitor`** (not "panel").

> **Trap:** `pm2` is installed under nvm and is **not on the non-interactive SSH PATH**. A plain
> `ssh vps "pm2 list"` fails with `command not found`. Use the absolute path:
> `/home/afsar/.nvm/versions/node/v22.22.3/bin/pm2`
> (running it still needs node on PATH — source nvm first, see §4).

---

## 2. Config — every key, every location, complete

The careers feature adds **one shared secret**, which must be byte-identical in three places. Nothing
else is new.

| Key | Location | Environment | Purpose |
|---|---|---|---|
| `OFFICIAL_ADMIN_SERVICE_KEY` | **Vercel** → `flocci-backend` project → Environment Variables | **production** | Backend accepts `X-Flocci-Service-Key` from the panel |
| `OFFICIAL_SERVICE_KEY` | **VPS** `~/flocci/panel/flocci-panel-srv/.env` | **production** | Panel presents the key when calling the backend |
| `OFFICIAL_API_URL` | **VPS** `~/flocci/panel/flocci-panel-srv/.env` | **production** | `https://apis.flocci.in` |
| `OFFICIAL_ADMIN_SERVICE_KEY` | Mac `flocci-backend/.env` | local dev only | optional |
| `OFFICIAL_SERVICE_KEY` + `OFFICIAL_API_URL` | Mac `flocci-panel-srv/.env` | local dev only | optional |

`OFFICIAL_ADMIN_SERVICE_KEY` (backend) and `OFFICIAL_SERVICE_KEY` (panel) are **the same value under
two different names**. They are compared byte-for-byte; any difference = 401.

The VPS panel `.env` currently has 26 keys and is missing both `OFFICIAL_*` entries. Everything else
it needs is already there.

Behaviour when unset: the panel's careers routes return `503 careers_link_not_configured` and the UI
shows a dedicated "not configured" state — deliberately, so a missing key never renders as an empty
list of applicants.

### Super admin
`afsar.s33@gmail.com` only, via `profiles.role = 'admin'` in `flocci_app_official` (already applied).
`ADMIN_EMAILS` in flocci-backend is deliberately **unset** so exactly one place decides.
Panel access is separately governed by `PANEL_ADMIN_EMAILS` in the VPS panel `.env`.

---

## 3. What has to ship

Four repos changed. `flocci-backend` and `flocci-official-landing-page` were already committed and
pushed earlier in this work; the two panel repos are new and uncommitted.

| Repo | Change | Deploy route |
|---|---|---|
| `flocci-backend` | careers persistence, admin API, S2S auth, `lib/admin.ts` hardening | push → Vercel auto-deploy |
| `flocci-official-landing-page` | login-gated apply, dashboard tracker, admin careers tab | push → Vercel auto-deploy |
| `flocci-panel-srv` | `routes/careers.js`, `config.js`, `index.js`, `.env.example` | push → **git pull on VPS** → pm2 restart |
| `flocci-panel-ui` | `src/components/careers/*`, `Dashboard.tsx` | push → build → serve from `/var/www` |

DB migration `flocci-backend/sql/career_applications.sql` is **already applied** to the live DB. Do
not re-run it (it is idempotent, but there is nothing to do).

---

## 4. Deploy, in order

### Step 1 — the shared secret
Generate once:
```bash
openssl rand -hex 32
```
Put that one value in:
1. Vercel → `flocci-backend` → Environment Variables → `OFFICIAL_ADMIN_SERVICE_KEY` (Production)
2. VPS panel `.env` (step 3 below)

### Step 2 — Vercel side
Push `flocci-backend` and `flocci-official-landing-page`, then **redeploy `flocci-backend`** so it
picks up the new env var. (A push alone deploys the code; an env var added afterwards needs a
redeploy.)

### Step 3 — VPS panel server
```bash
ssh afsar@15.235.166.170
source ~/.nvm/nvm.sh
cd ~/flocci/panel/flocci-panel-srv
git pull
npm install --omit=dev          # no new dependencies were added, safe no-op
```
Then append the two keys to `~/flocci/panel/flocci-panel-srv/.env`:
```
OFFICIAL_API_URL=https://apis.flocci.in
OFFICIAL_SERVICE_KEY=<the same value from step 1>
```
Restart:
```bash
pm2 restart vps-monitor && pm2 logs vps-monitor --lines 30
```

### Step 4 — VPS panel UI
A UI git checkout exists at `~/flocci/panel/flocci-panel-ui`, and nginx serves
`/var/www/flocci/flocci-panel-ui/dist`. Either:

**Build on the VPS**
```bash
source ~/.nvm/nvm.sh
cd ~/flocci/panel/flocci-panel-ui
git pull && npm install && npm run build
sudo rsync -a --delete dist/ /var/www/flocci/flocci-panel-ui/dist/
```

**or build on the Mac and rsync** (matches the house VPS drill)
```bash
cd ~/Desktop/work/flocci-panel/flocci-panel-ui && npm run build
rsync -az --delete dist/ afsar@15.235.166.170:/tmp/panel-dist/
ssh afsar@15.235.166.170 "sudo rsync -a --delete /tmp/panel-dist/ /var/www/flocci/flocci-panel-ui/dist/"
```
No nginx reload needed — static files only.

---

## 5. Verify (in this order — each isolates a different failure)

```bash
# 1. Backend accepts the key at all (run from anywhere)
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "X-Flocci-Service-Key: <key>" \
  https://apis.flocci.in/api/admin/careers/summary
# 200 = key matches · 401/403 = key mismatch · 503 = DB_TARGET not vps
```

```bash
# 2. Panel relay works (run ON the VPS, bypasses nginx + browser auth)
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3010/api/careers/summary
# 401 expected without a panel session — that is fine, it proves the route is mounted.
# 503 careers_link_not_configured = the .env keys did not load; pm2 was not restarted.
```

3. Browser: sign in at `panel.flocci.in` as `afsar.s33@gmail.com` → **Careers** tab loads real counts.
4. Browser: `flocci.in/careers` → apply signed-out → sign-in gate → apply → `flocci.in/dashboard`
   shows the tracker → move the status from the panel → candidate dashboard reflects it.

---

## 6. Rollback

- **Panel srv:** `cd ~/flocci/panel/flocci-panel-srv && git reset --hard e7a4947 && pm2 restart vps-monitor`
- **Panel UI:** the `/var/www/flocci/` convention is a `.rollback-YYYYMMDD` sibling — copy the dist
  aside before overwriting if you want one.
- **Careers link only:** blank `OFFICIAL_SERVICE_KEY` on the VPS and restart. The Careers tab reverts
  to the "not configured" state; nothing else in the panel is affected.
- **Backend:** Vercel → Deployments → promote the previous one. The DB tables are additive and
  untouched by a rollback; the candidate flow degrades to whatever the previous build did.

---

## 7. Known-good baseline (2026-08-05)

- panel-srv `main` @ `e7a4947`, panel-ui `main` @ `d85b398` — the commits live on the VPS before this change
- `career_applications` / `career_application_events` / `career_application_resumes` live, 0 rows
- `profiles`: 18 rows, `afsar.s33@gmail.com` = admin
- Gates at time of writing: backend `tsc` clean in touched files + build OK · landing `tsc` 0, build 0,
  59 routes pre-rendered · panel-ui `tsc` 0, build 0
- **Never verified end-to-end over HTTP** — see §5.4. That is the outstanding risk.
