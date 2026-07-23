# Governance OS — Ahmad A. Abed Holding

A full-stack governance and compliance platform: policies, SOPs, standards and processes with a Draft → Released → HOD → Executive → Active lifecycle; the organization structure, employees, job descriptions, grades and competencies; RACI, risk & control registers, acknowledgement campaigns, process-flow design with swimlanes, an AI assistant, an audit trail, and evidence-pack export.

It runs as a real server with a **shared database**, **logins**, and **server-enforced roles** — designed for live, multi-user use. It is seeded with your real employee/org data (266 people, 8 entities) plus industry-standard governance content across 13 domains.

## Requirements

- Node.js 22.5 or newer (uses Node's built-in SQLite).

## Run it

**Easiest (macOS):** double-click `start.command`. On first run it installs dependencies, then starts the server and opens the app.

**Manual (any OS):**

```bash
npm install
npm start
```

Then open http://localhost:4000 and sign in.

## Sign in

Seed accounts (default password **AAA@govos2026** — change these before real use):

| Email | Role | Can do |
|-------|------|--------|
| asif@aaabed.com | Admin | Everything, incl. user management and reset |
| m.abed@aaabed.com | Executive | Approve final (activate) + all Author actions |
| t.ibrahim@aaabed.com | Executive | Approve final (activate) + all Author actions |
| k.alduwayk@aaabed.com | HOD | Approve HOD stage + all Author actions |
| e.ramadan@aaabed.com | HOD | Approve HOD stage + all Author actions |
| author@aaabed.com | Author | Create/edit artifacts, raise change requests |
| viewer@aaabed.com | Viewer | Read + acknowledge only |

Roles are enforced on the server, not just hidden in the UI. Admins can add users via the API (`POST /api/admin/users`).

## Architecture

- **Frontend:** the same modular UI (`assets/`), now talking to the server API instead of browser storage. The data layer is isolated in `assets/js/db.js`.
- **Backend:** `server/` — Express API, authentication (JWT in an httpOnly cookie), role-based access control, and a document-style store on Node's built-in SQLite (`data/governance.db`).
- **Storage is swappable:** all data access goes through `server/store.js`, so moving to PostgreSQL for a larger deployment is a contained change.

## Navigation & configuration

The portal is organized into eight workspaces (Governance Center, Document Management, My Governance Work, Process & Operating Model, Compliance & Assurance, Organization & Accountability, Intelligence & Reporting, Administration), with breadcrumbs, a quick-create menu, favorites and recently-viewed.

Document types are configuration, not code. In Administration, an Admin can add or edit document types (code prefix, default sections, review period, retention, workflow and custom fields) and the document editor picks these up automatically - so new types and fields can be added without rebuilding the app. Seeded content is labelled "Demo data" and must be validated by the responsible department before operational use.

## Controlled documents, versioning & workflow

Every document follows a controlled lifecycle. Submitting for approval captures an immutable version snapshot with a change justification and routes it through a configurable workflow (default: HOD review then Executive approval). At each stage the assigned role can Approve, Request changes, Return for correction, or Reject with a comment; the submitter can Cancel. Self-approval is blocked (you cannot approve a document you own), and stage roles are enforced on the server.

On final approval the document becomes Active with an effective date, a new major version, and the prior active version is marked Superseded. You can view any past version, compare two versions side by side with redline highlighting, roll back to a previous version (creates a new draft), withdraw an active document, and print a watermarked Controlled Copy. Version and approval history are included in the exported evidence pack.

## Data

- Seed data lives in `assets/js/data/` and is loaded into the database on first start (and re-seeded automatically when the seed version changes). This folder is **not** served publicly.
- The live database is `data/governance.db`. Back this file up to protect real data.
- Admins can reset to seed data from Settings, or `POST /api/admin/reset`.

## Deploy (production)

1. Run behind HTTPS (a reverse proxy such as Nginx/Caddy).
2. Set environment variables: `GOV_SECRET` (JWT signing secret), `PORT`, optionally `GOV_DB` (database path) and `GOV_DEFAULT_PASSWORD`.
3. Change all seed passwords; add real users.
4. For scale/concurrency, swap SQLite for PostgreSQL in `server/store.js`.
5. Optional: wire Microsoft Entra (Azure AD) SSO — the auth layer is structured to add it.

## AI Assistant

Settings → AI Assistant connection. Add a provider + API key to connect a live model; otherwise it answers from your repository using grounded local retrieval.
