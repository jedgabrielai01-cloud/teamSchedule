#!/usr/bin/env bash
# Run once on a fresh Ubuntu 22.04 GCP e2-micro VM via SSH.
# Usage: bash setup-gcp-vm.sh
set -euo pipefail

echo "=== Installing Docker ==="
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

sudo usermod -aG docker "$USER"

echo "=== Cloning repository ==="
git clone https://github.com/jedgabrielai01-cloud/Projects.git ~/Projects

echo ""
echo "=== Setup complete ==="
echo "Next steps:"
echo "  1. Place your .env file at: ~/Projects/claude_teamSchedule/.env"
echo "  2. Log out and back in (for docker group to take effect), then run:"
echo "     bash ~/Projects/claude_teamSchedule/scripts/deploy-gcp.sh"
