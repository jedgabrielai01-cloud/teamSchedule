---
phase: Feature_01
plan: "05"
type: execute
wave: 5
depends_on: ["01", "02", "03", "04"]
files_modified:
  - frontend/next.config.ts
  - scripts/start-win.bat
  - scripts/start-unix.sh
  - Dockerfile
  - docker-compose.yml
autonomous: false
requirements:
  - F1-BUILD
  - F1-LOCAL
  - F1-GCP
must_haves:
  truths:
    - "The Next.js frontend builds successfully with no TypeScript errors"
    - "The Docker image builds successfully"
    - "The app runs on localhost:8000 and the calendar is accessible"
    - "The floating chat bubble is visible in the browser"
    - "The day CRUD modal opens when a day is clicked"
    - "GCP deployment config is present for VM at 35.196.210.214"
  artifacts:
    - path: "frontend/out"
      provides: "Static export built from Next.js"
      contains: "index.html"
    - path: "docker-compose.yml"
      provides: "Production compose with build + run"
      contains: "8000:8000"
  key_links:
    - from: "Dockerfile"
      to: "frontend/out"
      via: "COPY --from=frontend-builder /app/frontend/out ./frontend/out"
      pattern: "frontend/out"
---

<objective>
Run the full build pipeline (Next.js + Docker), verify the app works in a local browser,
and prepare GCP deployment configuration for VM at 35.196.210.214.

Purpose: Before GCP deployment, the user needs to sign off on local behavior. This plan
produces a working local build and a deployment-ready configuration.

Output:
- A passing `npm run build` in frontend/
- A passing `docker compose build && docker compose up`
- User can access http://localhost:8000 and verify all Feature_01 changes
- GCP deployment script ready for the signoff step
</objective>

<execution_context>
@E:/AI Playground/Projects/claude_teamSchedule/Dockerfile
@E:/AI Playground/Projects/claude_teamSchedule/docker-compose.yml
</execution_context>

<context>
@E:/AI Playground/Projects/claude_teamSchedule/Dockerfile
@E:/AI Playground/Projects/claude_teamSchedule/docker-compose.yml
@E:/AI Playground/Projects/claude_teamSchedule/frontend/next.config.ts

<interfaces>
Existing Dockerfile stages:
1. node:22-alpine as frontend-builder: runs npm ci + npm run build → produces frontend/out
2. python:3.13-slim: uv sync --no-dev --frozen, copies backend + data + frontend/out, runs uvicorn

GCP VM: 35.196.210.214
Port: 8000 (same as dev)

Existing scripts directory:
- scripts/ (should contain start-win.bat, start-unix.sh based on AGENTS.md)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Build frontend and Docker image, verify build succeeds</name>
  <files>frontend/next.config.ts</files>
  <read_first>
    - frontend/next.config.ts — check current config
    - frontend/app/calendar/page.tsx — confirm FloatingChat import is present (from Plan 02)
    - frontend/components/FloatingChat.tsx — confirm it exists (from Plan 02)
    - frontend/components/DayCrudModal.tsx — confirm it exists (from Plan 03)
  </read_first>
  <action>
Step 1 — Run the Next.js build and fix any TypeScript or build errors:

```bash
cd "E:/AI Playground/Projects/claude_teamSchedule/frontend" && npm run build 2>&1
```

If the build fails, diagnose from the error output. Common issues from Feature_01 changes:
- Missing import: add the import at the top of the offending file
- Type mismatch in DayCrudModal props: check that Calendar passes the correct types
- `window` undefined: ensure FloatingChat uses useEffect for initial pos (already in the plan)
- Unused import warnings treated as errors: remove unused imports

Fix each error by editing the relevant file. Re-run `npm run build` after each fix.
Do NOT proceed to Docker build until `npm run build` exits with code 0.

Step 2 — Build the Docker image:

```bash
cd "E:/AI Playground/Projects/claude_teamSchedule" && docker compose build 2>&1
```

If the Docker build fails:
- If it is a frontend build failure: fix in next.config.ts or relevant component
- If it is a Python dependency issue: check pyproject.toml is valid TOML (from Plan 01)
- If it is a COPY error (frontend/out not found): ensure npm run build ran first in the Dockerfile stage

Step 3 — Verify uv.lock is in sync with pyproject.toml changes from Plan 01:

The Dockerfile runs `uv sync --no-dev --frozen`. If Plan 01 added dev-dependencies to pyproject.toml
the `--no-dev --frozen` flag should still work (dev deps are skipped). However, if pyproject.toml
changed in a way that breaks the frozen lockfile, run:

```bash
cd "E:/AI Playground/Projects/claude_teamSchedule/backend" && uv lock
```

Then re-commit uv.lock and rebuild.

NOTE: Only modify `frontend/next.config.ts` if a specific Next.js configuration fix is needed.
The file should not be modified without a concrete reason from the build output.
  </action>
  <verify>
    <automated>cd "E:/AI Playground/Projects/claude_teamSchedule/frontend" && npm run build 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `npm run build` exits with code 0 (no errors in output, last line shows "Build complete" or similar)
    - `frontend/out/` directory exists after build
    - `frontend/out/index.html` exists
    - `docker compose build` exits with code 0
    - No TypeScript errors in the build output
  </acceptance_criteria>
  <done>Frontend builds to static export. Docker image builds successfully.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
All Feature_01 changes are built and running in Docker at http://localhost:8000.

Start the container before this checkpoint:
```bash
cd "E:/AI Playground/Projects/claude_teamSchedule" && docker compose up -d
```
  </what-built>
  <how-to-verify>
Open http://localhost:8000 in your browser and verify the following:

1. LOGIN:
   - Navigate to http://localhost:8000/login
   - Log in with a team member username (e.g., "Jed") and password "RSD"
   - Confirm redirect to /calendar

2. FLOATING CHAT BUBBLE on Calendar page:
   - Confirm you see a small "AI" button in the bottom-right corner of the screen
   - Drag the button to a different position — confirm it moves freely
   - Click the "AI" button — confirm the chat panel opens
   - Type a message and click Send — confirm the AI responds
   - Click Clear — confirm the chat history is cleared
   - Click the "x" button — confirm the chat panel closes
   - Confirm the calendar takes full width (no sidebar)

3. DAY CRUD MODAL on Calendar page:
   - Click on any current-month day box
   - Confirm a modal opens showing date, Vacation Leaves, Primary Support, and Holidays sections
   - Close the modal with the X button

4. ADMIN PAGE:
   - Log out and log in as "Admin" with password "RSD"
   - Confirm redirect to /admin
   - Confirm the floating "AI" chat bubble appears on the admin page
   - Click the bubble — confirm it opens the admin AI assistant
   - Switch to the Calendar tab — click a day box — confirm the CRUD modal opens
   - Confirm the modal shows "Add Leave" button (admin can add for any member)

5. LEAVE CRUD RULES (optional spot check):
   - As a regular user: open day modal — confirm you see your own leaves with Edit/Delete
   - Confirm other members' leaves show without Edit/Delete buttons
   - Confirm "Primary Support" section shows edit capability

Report any issues. Type "approved" if everything works as expected.
  </how-to-verify>
  <resume-signal>Type "approved" to continue to GCP prep, or describe any issues found.</resume-signal>
</task>

<task type="auto">
  <name>Task 3: Prepare GCP deployment configuration</name>
  <files>scripts/start-win.bat, scripts/start-unix.sh</files>
  <read_first>
    - scripts/ directory — list existing files to understand what already exists
    - docker-compose.yml — read current file to base GCP config on it
  </read_first>
  <action>
This task runs ONLY after the user has given signoff in the checkpoint above.

Check what is already in the scripts/ directory:
```bash
ls "E:/AI Playground/Projects/claude_teamSchedule/scripts/"
```

The GCP VM is at IP: 35.196.210.214. The app runs on port 8000 inside the container.

Inspect existing start scripts. If `scripts/start-win.bat` or `scripts/start-unix.sh` already exist,
read them and update them to reflect the Feature_01 state (no changes needed unless scripts reference
old components or outdated commands).

Create or update `scripts/deploy-gcp.sh` with deployment instructions:

```bash
#!/bin/bash
# Deploy to GCP VM at 35.196.210.214
# Prerequisites:
#   - SSH access to 35.196.210.214
#   - Docker installed on the VM
#   - .env file present on the VM at /app/.env
#   - GCP VM firewall allows TCP 8000 (or 80 if proxied)
#
# Usage: ./scripts/deploy-gcp.sh

set -e

GCP_HOST="35.196.210.214"
GCP_USER="${GCP_USER:-$(whoami)}"
REMOTE_DIR="/app/teamSchedule"

echo "Deploying to ${GCP_USER}@${GCP_HOST}:${REMOTE_DIR}"

# 1. Copy project files to the VM (exclude node_modules, .venv, db, .next, frontend/out)
rsync -avz --exclude='.git' \
  --exclude='frontend/node_modules' \
  --exclude='frontend/.next' \
  --exclude='frontend/out' \
  --exclude='backend/.venv' \
  --exclude='db/' \
  --exclude='e2e/node_modules' \
  "E:/AI Playground/Projects/claude_teamSchedule/" \
  "${GCP_USER}@${GCP_HOST}:${REMOTE_DIR}/"

# 2. On the VM: build and start
ssh "${GCP_USER}@${GCP_HOST}" bash << 'REMOTE'
  cd /app/teamSchedule
  docker compose build
  docker compose down --remove-orphans
  docker compose up -d
  echo "Deployment complete. App running at http://35.196.210.214:8000"
REMOTE
```

Make the script executable:
- On Unix: `chmod +x scripts/deploy-gcp.sh`
- On Windows: this is noted as a comment in the file header

Also create `scripts/deploy-gcp.ps1` for Windows users:

```powershell
# Deploy to GCP VM at 35.196.210.214
# Usage: .\scripts\deploy-gcp.ps1
# Requires: ssh and rsync available (Git for Windows includes both)

param(
  [string]$GcpUser = $env:GCP_USER,
  [string]$GcpHost = "35.196.210.214",
  [string]$RemoteDir = "/app/teamSchedule"
)

if (-not $GcpUser) {
  Write-Error "Set GCP_USER environment variable or pass -GcpUser parameter"
  exit 1
}

$ProjectRoot = Split-Path $PSScriptRoot -Parent

Write-Host "Deploying to ${GcpUser}@${GcpHost}:${RemoteDir}"

# Sync files (requires rsync or scp)
& rsync -avz --exclude='.git' `
  --exclude='frontend/node_modules' `
  --exclude='frontend/.next' `
  --exclude='frontend/out' `
  --exclude='backend/.venv' `
  --exclude='db/' `
  --exclude='e2e/node_modules' `
  "$ProjectRoot/" `
  "${GcpUser}@${GcpHost}:${RemoteDir}/"

# Build and start on the VM
$RemoteCommands = @"
cd $RemoteDir
docker compose build
docker compose down --remove-orphans
docker compose up -d
echo "App running at http://${GcpHost}:8000"
"@

& ssh "${GcpUser}@${GcpHost}" $RemoteCommands
```

Do NOT modify docker-compose.yml for GCP — the existing file (ports 8000:8000) is correct.
The GCP VM must have the .env file with OPENROUTER_API_KEY deployed separately (not committed to git).
  </action>
  <verify>
    <automated>cd "E:/AI Playground/Projects/claude_teamSchedule" && ls scripts/deploy-gcp.sh 2>/dev/null || ls scripts/deploy-gcp.ps1 2>/dev/null && echo "GCP scripts exist"</automated>
  </verify>
  <acceptance_criteria>
    - `scripts/deploy-gcp.sh` exists and contains `35.196.210.214`
    - `scripts/deploy-gcp.ps1` exists and contains `35.196.210.214`
    - Both scripts reference `docker compose build` and `docker compose up -d`
    - Both scripts use rsync with `--exclude` for node_modules, .venv, db/, frontend/out
    - Neither script commits or exposes the .env file
  </acceptance_criteria>
  <done>GCP deployment scripts exist for both Unix and Windows. User can deploy with ssh+rsync after signoff.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| deploy script -> GCP VM | SSH key auth; .env not committed |
| browser -> localhost:8000 | Local only; no public exposure until GCP deploy |
| browser -> 35.196.210.214:8000 | Public internet after GCP deploy |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-F1-05-01 | Information Disclosure | .env with OPENROUTER_API_KEY on GCP VM | mitigate | deploy script does not copy .env; user manually places .env on VM; .env in .gitignore |
| T-F1-05-02 | Denial of Service | Port 8000 exposed on public GCP VM | accept | Low-value target (internal team tool); GCP firewall should restrict to team IPs if desired — noted in deploy script comment |
| T-F1-05-03 | Spoofing | No HTTPS on GCP port 8000 | accept | Internal team use only; no PII transmitted beyond team member names; HTTPS upgrade is a future phase item |
</threat_model>

<verification>
After all tasks:
1. `ls frontend/out/index.html` — exists (build succeeded)
2. `docker compose ps` — app container is running
3. `curl -s http://localhost:8000 | grep -c "html"` — returns >= 1 (app is serving)
4. `ls scripts/deploy-gcp.sh` — file exists
5. `grep "35.196.210.214" scripts/deploy-gcp.sh` — returns a match
6. User has confirmed all Feature_01 UI changes work in browser (checkpoint approved)
</verification>

<success_criteria>
- `npm run build` succeeds with no errors
- `docker compose build && docker compose up -d` succeeds
- App is accessible at http://localhost:8000
- User has visually verified: floating chat bubble, day CRUD modal, admin page changes
- GCP deployment scripts exist and are ready to use after signoff
- No TypeScript errors, no build warnings treated as errors
</success_criteria>

<output>
After completion, create `.planning/phases/Feature_01/Feature_01-05-SUMMARY.md` with:
- Whether build passed on first attempt or what was fixed
- Docker image size if available
- User signoff status (approved/issues found)
- GCP deployment script locations
- Next step: user runs `./scripts/deploy-gcp.sh` (or .ps1 on Windows) after providing GCP_USER
</output>
