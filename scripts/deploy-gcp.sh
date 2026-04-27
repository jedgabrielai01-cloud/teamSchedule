#!/usr/bin/env bash
# Deploy or update the app on the GCP VM.
# Run from anywhere on the VM; safe to re-run for updates.
set -euo pipefail

APP_DIR="$HOME/Projects/claude_teamSchedule"

echo "=== Pulling latest code ==="
cd "$HOME/Projects"
git pull

echo "=== Building and starting container ==="
cd "$APP_DIR"
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

EXTERNAL_IP=$(curl -sf \
  -H "Metadata-Flavor: Google" \
  "http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip" \
  || echo "<external-ip>")

echo ""
echo "=== Deployed ==="
echo "Access the app at: http://${EXTERNAL_IP}"
