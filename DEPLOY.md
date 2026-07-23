# Deploying Governance OS (free: Render + Neon)

This app is a Node/Express server with a database and logins. It runs on **Render**
(free web service) with data in **Neon** (free Postgres). Both are free and need no
credit card. Every push to GitHub auto-deploys - or double-click `deploy.command`.

Locally (no `DATABASE_URL`) the app uses a built-in SQLite file, so nothing changes
for development. When `DATABASE_URL` is set (on Render), it uses Neon Postgres.

---

## One-time setup (~10 minutes)

### 1. Create the free Postgres database (Neon)
1. Go to https://neon.tech and sign up (GitHub login is fine).
2. Create a project (any name, pick a region near KSA, e.g. Frankfurt/eu-central-1).
3. Copy the **connection string** (starts with `postgresql://...`, ends with `?sslmode=require`).
   Keep it for step 4.

### 2. Put the code on GitHub
From this folder:
```
git init
git add -A
git commit -m "Governance OS initial deploy"
git branch -M main
```
Create an empty repo on https://github.com/new (e.g. `aaa-governance-os`, Private), then:
```
git remote add origin https://github.com/<you>/aaa-governance-os.git
git push -u origin main
```

### 3. Create the web service (Render)
1. Go to https://render.com and sign up (GitHub login is fine).
2. **New > Blueprint**, pick your repo. Render reads `render.yaml` automatically.
3. When prompted for environment variables, set:
   - `DATABASE_URL` = the Neon string from step 1.
   - `GOV_DEFAULT_PASSWORD` = a password for the seeded accounts (or keep the default).
   - `GOV_SECRET` is generated automatically - leave it.
4. Click **Apply / Deploy**. First build takes a few minutes; it seeds the database on boot.
5. Your public URL will be `https://aaa-governance-os.onrender.com` (or similar).

### 4. Log in
Use a seeded account, e.g. `asif@aaabed.com` with the `GOV_DEFAULT_PASSWORD` you set
(default `AAA@govos2026`). Change passwords via Administration once in.

---

## Updating the live site (the seamless part)

Any time you want to publish changes:

- **Double-click `deploy.command`**, or
- Run in Terminal:
  ```
  ./deploy.command "what changed"
  ```

It commits and pushes; Render redeploys automatically in ~1-2 minutes. That's it.

---

## Notes

- **Free tier behaviour:** Render free web services sleep after ~15 min idle and take
  ~1 minute to wake on the next visit. Neon stays free and persistent (it only sleeps
  compute when idle and wakes on the next query). Data is durable across deploys.
- **Changing seed data:** bump `seedVersion` in `assets/js/data/governance.json`; the
  app reseeds on next deploy. Or, as Admin, use Administration > reset.
- **Local Postgres test (optional):** set `DATABASE_URL` in a local `.env` and run
  `npm start`. With no `DATABASE_URL`, it uses SQLite at `data/governance.db`.
- **Security:** `GOV_SECRET` is auto-generated on Render (not the dev default). Broader
  security hardening (SSO, rate limiting, audit-store integrity) is a separate phase.
