# Free Deployment Guide (Render + Cloudflare Pages + Neon)

This guide is for this repo structure:

- `server` -> Express API
- `web` -> Vue + Vite frontend

Recommended free stack for testing:

- Database: Neon Postgres (free)
- API: Render Web Service (free)
- Frontend: Cloudflare Pages (free)

---

## 0) Prerequisites

- Push this project to GitHub (public or private).
- Make sure local code is the latest commit.
- Have accounts ready:
  - Neon
  - Render
  - Cloudflare

---

## 1) Create Free Postgres on Neon

1. Go to Neon dashboard -> create project.
2. Copy connection string (`DATABASE_URL`), example:

```bash
postgresql://<user>:<password>@<host>/<db>?sslmode=require
```

3. Keep this value safe. You will use it in Render environment variables.

Security note:

- Do NOT commit your real `DATABASE_URL` into GitHub.
- If you accidentally leaked it, rotate the Neon password immediately.

---

## 2) Deploy API on Render (server)

### 2.1 Create service

1. Render -> New -> Web Service.
2. Connect your GitHub repo.
3. Fill fields:
   - Name: `inventory-api-test` (or any name)
   - Region: choose nearest
   - Branch: `main` (or your deploy branch)
   - Root Directory: `server`
   - Runtime: `Node`
   - Build Command:

```bash
npm install
```

   - Start Command:

```bash
npm start
```

### 2.2 Environment variables (Render -> Environment)

Add these keys:

- `PORT` = `4000`
- `DATABASE_URL` = `<your neon DATABASE_URL>`
- `JWT_SECRET` = `<a long random string>`
- `NODE_ENV` = `production`
- `SHOPEE_SYNC_ENDPOINT` = `` (optional)
- `SHOPEE_ACCESS_TOKEN` = `` (optional)
- `LAZADA_SYNC_ENDPOINT` = `` (optional)
- `LAZADA_ACCESS_TOKEN` = `` (optional)
- `TIKTOK_SYNC_ENDPOINT` = `` (optional)
- `TIKTOK_ACCESS_TOKEN` = `` (optional)

Important:

- `JWT_SECRET` must stay stable; do not change frequently, or users will get 401 and need relogin.
- If your deploy “Timed Out”, it usually means the service didn't bind the port fast enough.
  - Confirm `DATABASE_URL` is set correctly.
  - Neon requires SSL; keep `?sslmode=require` in the URL.
  - Check Render logs for `Failed to connect database on startup`.

### 2.3 Get API URL

After deploy success, note the public URL, for example:

```text
https://inventory-api-test.onrender.com
```

Health check:

```bash
curl https://inventory-api-test.onrender.com/api/health
```

---

## 3) Initialize DB Schema + Seed (one time)

You must run schema at least once for new tables (`suppliers`, `settings`, etc.).

Run locally with Neon URL:

```bash
psql "$DATABASE_URL" -f server/database/schema.sql
psql "$DATABASE_URL" -f server/database/seed.sql
```

If your shell does not have `psql`, install Postgres client first.

Verification query:

```bash
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM users;"
```

---

## 4) Deploy Frontend on Cloudflare Pages (web)

### 4.1 Create Pages project

1. Cloudflare Dashboard -> Workers & Pages -> Create -> Pages -> Connect to Git.
2. Select this repository.
3. Fill build settings:
   - Framework preset: `Vue` (or `None`, both OK)
   - Option A (recommended): set Root directory to `web`
     - Root directory: `web`
     - Build command:

```bash
npm ci && npm run build
```

     - Build output directory:

```text
dist
```

   - Option B: keep Root directory as repo root
     - Root directory: *(empty / repository root)*
     - Build command:

```bash
npm run build
```

     - Build output directory:

```text
web/dist
```

### 4.2 Environment variable (Pages -> Settings -> Environment variables)

Add:

- `VITE_API_URL` = `https://inventory-api-test.onrender.com/api`

Do this for:

- Production environment
- Preview environment (recommended)

Then redeploy.

---

## 4.3 If you accidentally used “Workers (Wrangler deploy)” instead of Pages

If Cloudflare shows a "Deploy command" (e.g. `npx wrangler deploy`) and you see:

```text
Asset too large ... web/node_modules/.../workerd (118 MiB)
```

That means you're uploading the whole `web/` folder as assets, including `node_modules`.

Fix:

- Prefer using **Pages** for this project (no deploy command).
- If you must use Wrangler:
  - Set "Path" to `web`
  - Build command:

```bash
npm ci && npm run build
```

  - Deploy command:

```bash
npx wrangler deploy
```

  - Ensure `web/wrangler.toml` has assets directory `./dist` (only upload the built output).

---

## 5) Cloudflare Pages “each page” fill checklist

When Cloudflare asks deployment fields, use exactly:

- Repository: `<your github repo>`
- Production branch: `main`
- Framework preset: `Vue`
- Root directory: `web`
- Build command: `npm run build`
- Build output directory: `dist`
- Node version: `20` (if configurable)
- Env var key: `VITE_API_URL`
- Env var value: `https://<your-render-domain>/api`

---

## 6) Render “each page” fill checklist

When Render asks service fields, use exactly:

- Service type: `Web Service`
- Runtime: `Node`
- Root directory: `server`
- Build command: `npm install`
- Start command: `npm start`
- Instance: `Free`
- Auto deploy: `On`
- Env `PORT`: `4000`
- Env `DATABASE_URL`: `<your neon url>`
- Env `JWT_SECRET`: `<random long string>`

---

## 7) First login / verification

Open Cloudflare Pages URL and login with seeded users:

- `admin@inventory.local` / `Admin@123`
- `manager@inventory.local` / `Manager@123`
- `staff@inventory.local` / `Staff@123`

Verify these routes/features:

- Dashboard loads without 401.
- Suppliers list/add/edit works.
- Settings page (`/settings`) visible for ADMIN only.
- Alerts and Products pages load.

---

## 8) Common issues

### 401 Unauthorized everywhere

- Token expired or invalid after `JWT_SECRET` change.
- Fix: relogin; keep `JWT_SECRET` stable.

### 404 on `/api/suppliers` or `/api/settings`

- API is old version or deploy failed.
- Fix:
  - Check Render latest deploy status.
  - Confirm `server/src/app.js` includes routes:
    - `/api/suppliers`
    - `/api/settings`

### 500 on settings/suppliers

- DB schema not applied.
- Fix: run `schema.sql` against Neon again.

### First request is slow

- Render free tier cold start is normal.

---

## 9) Optional hardening for test env

- Change default seeded passwords after first login.
- Restrict CORS if needed.
- Rotate `JWT_SECRET` only when necessary (forces relogin).
