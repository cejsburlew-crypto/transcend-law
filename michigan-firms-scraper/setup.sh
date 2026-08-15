#!/bin/bash
set -e

echo "Setting up Michigan Firms Scraper..."

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Install Playwright browser
echo "Installing Playwright Chromium..."
python -m playwright install chromium

# Create output directories
echo "Creating output directories..."
mkdir -p /private/tmp/claude-501/-Users-jbconsultingassociatesinc--code-transcend-ssp/9e95c4e3-aa1f-4687-afed-1131263d4443/scratchpad/output
mkdir -p /private/tmp/claude-501/-Users-jbconsultingassociatesinc--code-transcend-ssp/9e95c4e3-aa1f-4687-afed-1131263d4443/scratchpad/checkpoints
mkdir -p /private/tmp/claude-501/-Users-jbconsultingassociatesinc--code-transcend-ssp/9e95c4e3-aa1f-4687-afed-1131263d4443/scratchpad/logs

echo "Setup complete!"
