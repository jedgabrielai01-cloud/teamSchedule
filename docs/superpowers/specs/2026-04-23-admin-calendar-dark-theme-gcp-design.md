# Design Spec: Admin Calendar, Dark Theme, GCP Deployment

Date: 2026-04-23

## Overview

Three parallel improvements to the team schedule app:

1. Add calendar interface to the admin page
2. Overhaul the frontend to a dark dashboard theme
3. Prepare GCP deployment requirements for hosting on an e2-micro VM

---

## Section 1: Admin Page — Calendar Integration

### Layout

The admin page is restructured so the calendar is always visible at the top, with the management tabs below:

```
┌─────────────────────────────────────────┬──────────┐
│  Header (gradient)                       │          │
├─────────────────────────────────────────│          │
│  Calendar (month nav + grid)             │ AI Panel │
├─────────────────────────────────────────│          │
│  Tabs: [Team Members] [CSV Upload]       │          │
│  Tab content                             │          │
└─────────────────────────────────────────┴──────────┘
```

### Implementation

- Reuse existing `Calendar.tsx` and `DayBox.tsx` component structure and logic unchanged; inline style color values in `DayBox.tsx` are updated as part of the dark theme sweep in Section 2
- `admin/page.tsx` gains calendar state: `month`, `year`, `calendarData`
- Same `/api/calendar?month=YYYY-MM` endpoint, same 5-second polling interval as the user calendar page
- Month navigation (prev/next) added above the calendar grid
- The AI panel sidebar stays on the right (existing behavior, existing endpoint `/api/ai/admin-chat`)
- No new backend endpoints required

---

## Section 2: Frontend Design — Dark Dashboard

### Design Direction

Dark navy theme applied consistently across all three pages (login, calendar, admin). Inspired by ops/monitoring dashboard aesthetics. The existing blue-to-orange color palette is preserved; role badge colors are adapted for legibility on dark backgrounds.

### CSS Custom Properties

Defined in `frontend/app/globals.css`:

```css
:root {
  --bg-page:        #1e2433;
  --bg-surface:     #252d3f;
  --bg-surface-alt: #1a2235;
  --border:         #2d3a52;
  --text-primary:   #e2e8f0;
  --text-secondary: #a0aec0;
  --text-muted:     #6b7a99;
  --header-bg:      linear-gradient(135deg, #1a3a6e, #2d5ca8);
  --accent-bar:     linear-gradient(90deg, #2d5ca8, #4A78C2, #D8B5A6, #F07A3F);
}
```

`body` background set to `var(--bg-page)`.

### Role Badge Colors (Dark-Adapted)

Color-coded legend is preserved on all calendar views (calendar page and admin page).

| Role / State   | Badge bg  | Badge text |
|----------------|-----------|------------|
| Primary        | `#2d5ca8` | `#93b8f5`  |
| Secondary      | `#3a6ab5` | `#a8c4f0`  |
| Backup         | `#3a5080` | `#b8cef0`  |
| Onshore        | `#5a3a30` | `#e8c8ba`  |
| On Leave       | `#7a3a18` | `#fdb882`  |
| Holiday        | `#6a2a10` | `#f0a070`  |

### Per-Page Changes

**Login (`/login`):**
- Page background: `--bg-page`
- Card: `--bg-surface`, `--border`, subtle box-shadow
- Input fields: `--bg-surface-alt` background, `--border` border, `--text-primary` text
- Submit button: existing orange gradient (`#F07A3F` → `#E0642F`), unchanged
- Bottom accent bar on card

**Calendar (`/calendar`):**
- Page background: `--bg-page`
- Header: `--header-bg` gradient
- Legend strip: `--bg-surface` background, `--border` bottom border
- Day boxes: `--bg-surface` background, `--border` border
- Out-of-month days: `--bg-surface-alt`, reduced opacity
- Today highlight: `--border` color border, slightly lighter surface
- AI panel: `--bg-surface-alt` background

**Admin (`/admin`):**
- Same dark treatment as calendar page
- Tab bar: `--bg-surface` background; active tab uses blue bottom border + `--text-primary`; inactive uses `--text-muted`
- Modals: `--bg-surface` background, `--border` border, backdrop `rgba(0,0,0,0.6)`
- Tables: alternating `--bg-surface` / `--bg-surface-alt` rows
- Form inputs: `--bg-surface-alt` background

**AIPanel (all pages):**
- Container: `--bg-surface-alt`
- User messages: `--bg-surface` bubble
- Assistant messages: `--bg-surface-alt` bubble
- Input field: `--bg-surface` background

### Bottom Accent Bar

A 2px `--accent-bar` gradient appears at the bottom of every header and every card/modal. Consistent visual anchor across pages.

---

## Section 3: GCP Deployment — e2-micro VM

### Target Infrastructure

| Setting | Value |
|---|---|
| Service | Compute Engine |
| Machine type | `e2-micro` |
| Region | `us-central1` (always-free tier) |
| Boot disk | 30 GB standard persistent disk |
| OS | Ubuntu 22.04 LTS |
| Firewall | Allow HTTP (80), HTTPS (443) |
| Cost | $0/month (GCP always-free tier) |

### Files Added to Repo

**`scripts/setup-gcp-vm.sh`**
Run once on a fresh VM over SSH. Does:
- `apt` update and install Docker + Docker Compose plugin
- Adds current user to `docker` group
- Clones the repo into `~/app`
- Prints reminder to place `.env` before deploying

**`scripts/deploy-gcp.sh`**
Run to deploy or update. Does:
- `git pull` latest code
- `docker compose -f docker-compose.prod.yml build`
- `docker compose -f docker-compose.prod.yml up -d`
- Idempotent — safe to re-run for updates

**`scripts/gcp-firewall.sh`**
Run once from local machine with `gcloud` CLI. Opens ports 80 and 443 on the VPC firewall.

**`docker-compose.prod.yml`**
Copy of `docker-compose.yml` with port mapping changed from `8000:8000` to `80:8000`, so the app is reachable on standard HTTP without a reverse proxy.

### Secrets Management

The `.env` file is not committed to git. On the VM, it is placed manually at `~/app/.env` before the first deploy. Contains: `OPENROUTER_API_KEY`, `JWT_SECRET`, `DB_PATH`.

### First-Time Deployment Steps

1. Create VM in GCP Console: e2-micro, us-central1, allow HTTP traffic checkbox ticked
2. SSH into VM via GCP Console or `gcloud compute ssh`
3. Run `bash scripts/setup-gcp-vm.sh`
4. Place `.env` at `~/app/.env`
5. Run `bash scripts/deploy-gcp.sh`
6. Access at `http://<external-ip>`

### Adding a Custom Domain Later

When ready:
1. Register a free subdomain (e.g., DuckDNS) or paid domain
2. Point the domain's A record to the VM's external IP
3. SSH into VM, install Certbot, run `certbot --nginx` or `certbot certonly`
4. Update `docker-compose.prod.yml` to also map port 443 and mount the cert files
5. No app code changes required

### Notes

- The user has offered to assist with the GCP setup steps (VM creation, firewall, SSH access). Coordinate with them before running deployment scripts.
- The VM's external IP is ephemeral by default in GCP. Reserve a static external IP in GCP Console to avoid the IP changing on VM restart.

---

## Out of Scope

- Changes to backend API or database schema
- Switching from SQLite to a managed database
- CI/CD pipeline
- Load balancing or multi-instance deployment
