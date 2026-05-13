# WhatsApp Integration Design

**Date:** 2026-05-14
**Scope:** Read-only inquiry bot via WhatsApp Business Cloud API

---

## Overview

Add a WhatsApp channel to the team schedule application that allows anyone to query vacation leaves, support schedules, and holidays via WhatsApp. The bot is fully anonymous (no user identity required), read-only (no mutations), and stateless (no conversation history).

The application is hosted on GCP at `35.196.210.214`. HTTPS is provided via DuckDNS free subdomain + Let's Encrypt, with nginx as the SSL terminator in Docker.

---

## Infrastructure

### DuckDNS (manual, one-time setup)
- Register a free subdomain at `duckdns.org` (e.g., `teamschedule.duckdns.org`) pointing to `35.196.210.214`
- Install the DuckDNS updater on the GCP VM to keep the IP current

### Docker Compose (`docker-compose.prod.yml`)
Two new services added alongside the existing `app` service:

**nginx**
- Listens on ports 80 and 443
- Terminates SSL using Let's Encrypt certificates from a shared `certbot` volume
- Proxies all traffic to `app` container over internal Docker networking (HTTP)
- Serves `/.well-known/acme-challenge/` for cert renewal

**certbot**
- Obtains and renews Let's Encrypt certificates
- Shares a volume with nginx for cert files

The `app` service stops publishing port 80 directly. nginx is the only public-facing service.

---

## WhatsApp Webhook Router (`backend/routers/whatsapp.py`)

### Endpoints

**`GET /api/whatsapp`** — Webhook verification
- Called once by Meta during app setup
- Validates `hub.verify_token` against `WHATSAPP_VERIFY_TOKEN` env var
- Returns `hub.challenge` on success, HTTP 403 on mismatch
- No authentication required

**`POST /api/whatsapp`** — Incoming message handler
- Called by Meta for every incoming WhatsApp message
- Validates `X-Hub-Signature-256` header using `WHATSAPP_APP_SECRET`; returns HTTP 403 on failure
- Extracts sender phone number and message text from payload
- Returns HTTP 200 immediately to Meta (within 20 seconds, satisfying Meta's requirement)
- Dispatches AI processing as a FastAPI `BackgroundTask`

### Background Task Flow
```
validate signature → return HTTP 200 → [background]
  extract phone number + message text
  if non-text message:
    send_whatsapp_message(phone, "I can only answer text questions about the team schedule.")
    return
  open fresh DB connection (FastAPI closes Depends(get_db) before background tasks run)
  try:
    response = call_openrouter(message, db)
    send_whatsapp_message(phone, response or fallback_text)
  except Exception:
    log error
    send_whatsapp_message(phone, fallback_text)
  finally:
    close DB connection
```

### Fallback messages
- AI timeout / network error: `"Sorry, the AI took too long to respond. Please try again."`
- AI error / malformed response: `"I ran into an issue processing your request. Please try again shortly."`
- Non-text message: `"I can only answer text questions about the team schedule."`

---

## Read-Only AI

### System Prompt (`_build_whatsapp_prompt(db)`)
- No logged-in user context, no identity references
- Full read access: any team member's leaves, schedules, holidays
- Data window: last 60 days and all future entries
- Response format: plain text only (no JSON, no action fields)
- Scope enforcement: refuses any question outside leaves, schedules, and holidays with a snarky one-liner
- Same personality as web assistant: snarky, dry, concise

### OpenRouter Call
- Single-turn exchange: `[system prompt] + [user message]`
- No history, no session state, no phone numbers stored
- Reuses `OPENROUTER_API_KEY` and the same model/fallback model as the existing AI
- Runs inside the background task; timeout and errors caught and handled with fallback replies

---

## Environment Variables

Four new variables added to `.env`:

| Variable | Purpose |
|---|---|
| `WHATSAPP_VERIFY_TOKEN` | Secret token for Meta webhook verification |
| `WHATSAPP_APP_SECRET` | App secret for validating `X-Hub-Signature-256` |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta phone number ID for sending messages |
| `WHATSAPP_ACCESS_TOKEN` | Meta permanent access token for the Cloud API |

---

## Meta App Setup (manual, one-time)

1. Create a Meta Business account and a WhatsApp Business app on the Meta Developer portal
2. Add a test phone number (or link a real SIM)
3. Configure the webhook URL: `https://teamschedule.duckdns.org/api/whatsapp`
4. Subscribe to the `messages` webhook field
5. Copy the phone number ID and access token into `.env`

---

## Prerequisites Checklist (manual setup before implementation)

### 1. DuckDNS (~5 minutes)
- Go to `duckdns.org` and log in
- Register a subdomain (e.g., `teamschedule.duckdns.org`) and set the IP to `35.196.210.214`
- Note your DuckDNS **token** — needed for the updater script on the GCP VM

### 2. GCP Firewall
- Ensure port **443** (HTTPS) is open on the GCP VM's firewall rules (port 80 should already be open)

### 3. Meta Developer Setup (~30 minutes)
- Go to `developers.facebook.com` and create an account
- Create a new App → type: **Business**
- Add the **WhatsApp** product to the app
- Under WhatsApp → Getting Started, note:
  - **Phone Number ID**
  - **App Secret** (under App Settings → Basic)
- Choose a **verify token** — any random string you make up (e.g., `my-secret-verify-token`)
- Configure the webhook URL (`https://your-subdomain.duckdns.org/api/whatsapp`) **after** the app is deployed with HTTPS

> **Permanent access token:** The test token from Meta expires every 24 hours. For production, go to Meta Business Manager → System Users → create a System User → assign it to your WhatsApp app → generate a permanent token. Use this in `.env`.

### 4. Values to collect for `.env`

| Variable | Where to get it |
|---|---|
| `WHATSAPP_VERIFY_TOKEN` | You choose — any random string |
| `WHATSAPP_APP_SECRET` | Meta App Settings → Basic |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta WhatsApp → Getting Started |
| `WHATSAPP_ACCESS_TOKEN` | Meta System User permanent token |

---

## What This Does Not Include

- Conversation history or session tracking (fully stateless)
- Phone number identity mapping or user authentication
- Any write operations (insert, update, delete) via WhatsApp
- Admin capabilities via WhatsApp
