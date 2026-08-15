#!/bin/bash
# Setup script for Texas State Bar Attorney Directory Scraper

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')

echo "================================================"
echo "Texas State Bar Scraper - Setup"
echo "================================================"
echo ""
echo "Python version: $PYTHON_VERSION"
echo "Script directory: $SCRIPT_DIR"
echo ""

# Check Python 3.8+
if ! python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)' 2>/dev/null; then
    echo "ERROR: Python 3.8+ required"
    exit 1
fi

# Create virtual environment
echo "[1/4] Creating virtual environment..."
python3 -m venv venv
source venv/bin/activate
echo "✓ Virtual environment created"
echo ""

# Install dependencies
echo "[2/4] Installing Python dependencies..."
pip install -q --upgrade pip setuptools wheel
pip install -r "$SCRIPT_DIR/requirements.txt"
echo "✓ Dependencies installed"
echo ""

# Install Playwright browsers
echo "[3/4] Installing Playwright browsers..."
python3 -m playwright install chromium
echo "✓ Playwright chromium installed"
echo ""

# Create output directories
echo "[4/4] Creating output directories..."
mkdir -p scratchpad/checkpoints
mkdir -p scratchpad/output
mkdir -p scratchpad/logs
echo "✓ Output directories created"
echo ""

echo "================================================"
echo "Setup Complete!"
echo "================================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Run reconnaissance (maps API endpoints):"
echo "   python 01_reconnaissance.py"
echo ""
echo "2. Test API endpoints:"
echo "   python 02_api_probe.py"
echo ""
echo "3. Start full scraper:"
echo "   python 03_production_scraper.py"
echo ""
echo "4. For testing only (first 2 pages):"
echo "   python 03_production_scraper.py --max-pages 2"
echo ""
echo "Output will be saved to: scratchpad/output/texas_attorneys.csv"
echo ""
