#!/usr/bin/env bash
# Run once from your LOCAL machine (not the VM) with gcloud CLI installed.
# Usage: bash gcp-firewall.sh YOUR_PROJECT_ID
set -euo pipefail

PROJECT_ID="${1:?Usage: bash gcp-firewall.sh YOUR_PROJECT_ID}"

echo "Creating firewall rules for project: $PROJECT_ID"

gcloud compute firewall-rules create allow-http \
  --project="$PROJECT_ID" \
  --direction=INGRESS \
  --priority=1000 \
  --network=default \
  --action=ALLOW \
  --rules=tcp:80 \
  --source-ranges=0.0.0.0/0 \
  --description="Allow HTTP for team schedule app" \
  --quiet || echo "allow-http rule already exists, skipping."

gcloud compute firewall-rules create allow-https \
  --project="$PROJECT_ID" \
  --direction=INGRESS \
  --priority=1000 \
  --network=default \
  --action=ALLOW \
  --rules=tcp:443 \
  --source-ranges=0.0.0.0/0 \
  --description="Allow HTTPS for team schedule app (for future domain + cert setup)" \
  --quiet || echo "allow-https rule already exists, skipping."

echo "Done. Firewall rules created."
