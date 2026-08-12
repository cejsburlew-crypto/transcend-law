#!/bin/bash
# Bond Intelligence — start all services

PHP=/Applications/MAMP/bin/php/php8.3.30/bin/php
API_DIR="$(dirname "$0")/bond-intelligence/api"
DASH_DIR="$(dirname "$0")/bond-intelligence/dashboard"

echo "=== Bond Intelligence Startup ==="

# Kill anything already on these ports
lsof -ti:8080 | xargs kill -9 2>/dev/null && echo "Cleared port 8080"
lsof -ti:3000 | xargs kill -9 2>/dev/null && echo "Cleared port 3000"
sleep 1

# Start PHP API on port 8080
echo "Starting PHP API on http://localhost:8080 ..."
$PHP -S localhost:8080 -t "$API_DIR/public" > /tmp/bond-api.log 2>&1 &
API_PID=$!

# Wait for API to be ready
sleep 2
if curl -s http://localhost:8080/api/v1/agencies > /dev/null 2>&1; then
  echo "✓ API running (PID $API_PID)"
else
  echo "✗ API failed to start — check /tmp/bond-api.log"
fi

# Start Angular dashboard on port 3000
echo "Starting Angular dashboard on http://localhost:3000 ..."
cd "$DASH_DIR" && npm start > /tmp/bond-dash.log 2>&1 &
DASH_PID=$!

echo ""
echo "Services starting up:"
echo "  API:       http://localhost:8080"
echo "  Dashboard: http://localhost:3000  (ready in ~10 seconds)"
echo ""
echo "Logs: tail -f /tmp/bond-api.log /tmp/bond-dash.log"
echo "Stop: kill $API_PID $DASH_PID"
echo ""
echo "Opening dashboard in 12 seconds..."
sleep 12
open http://localhost:3000
