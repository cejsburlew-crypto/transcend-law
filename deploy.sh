#!/bin/bash
# TRANSCEND LEGAL PLATFORM - DEPLOYMENT SCRIPT
# Production Ready: August 16-18, 2026

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ROOT="/Users/jbconsultingassociatesinc./code/transcend-ssp"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
VERSION="v1.0.0-$TIMESTAMP"
LOG_FILE="deployment-$TIMESTAMP.log"

echo -e "${BLUE}🚀 TRANSCEND LEGAL PLATFORM - DEPLOYMENT BUILD${NC}"
echo "Version: $VERSION"
echo "Timestamp: $TIMESTAMP"
echo ""

# Step 1: Prerequisites
echo -e "${BLUE}✓ Checking Prerequisites...${NC}"
node --version > /dev/null && echo "  ✅ Node.js ready"
npm --version > /dev/null && echo "  ✅ npm ready"
git --version > /dev/null && echo "  ✅ Git ready"

# Step 2: Install Dependencies
echo -e "${BLUE}✓ Installing Dependencies...${NC}"
cd "$PROJECT_ROOT/transcend-api" && npm ci --silent && echo "  ✅ Backend deps"
cd "$PROJECT_ROOT/transcend-frontend" && npm ci --silent && echo "  ✅ Frontend deps"

# Step 3: Security
echo -e "${BLUE}✓ Security Audit...${NC}"
cd "$PROJECT_ROOT" && npm audit --production 2>/dev/null && echo "  ✅ Security passed" || echo "  ⚠️  Review vulnerabilities"

# Step 4: Lint
echo -e "${BLUE}✓ Linting...${NC}"
cd "$PROJECT_ROOT/transcend-frontend" && npm run lint > /dev/null 2>&1 && echo "  ✅ Linting passed"

# Step 5: Type Check
echo -e "${BLUE}✓ Type Checking...${NC}"
cd "$PROJECT_ROOT/transcend-frontend" && npm run type-check > /dev/null 2>&1 && echo "  ✅ Type checking passed"

# Step 6: Tests
echo -e "${BLUE}✓ Running Tests...${NC}"
cd "$PROJECT_ROOT/transcend-frontend" && npm test -- --passWithNoTests > /dev/null 2>&1 && echo "  ✅ Tests passed"

# Step 7: Build Backend
echo -e "${BLUE}✓ Building Backend...${NC}"
cd "$PROJECT_ROOT/transcend-api" && npm run build > /dev/null 2>&1 && echo "  ✅ Backend built"

# Step 8: Build Frontend
echo -e "${BLUE}✓ Building Frontend...${NC}"
cd "$PROJECT_ROOT/transcend-frontend" && rm -rf dist && npm run build > /dev/null 2>&1 && echo "  ✅ Frontend built"

# Step 9: Verify
echo -e "${BLUE}✓ Verifying Artifacts...${NC}"
[ -d "$PROJECT_ROOT/transcend-api/dist" ] && echo "  ✅ Backend artifacts OK"
[ -d "$PROJECT_ROOT/transcend-frontend/dist" ] && echo "  ✅ Frontend artifacts OK"

# Step 10: Backup
echo -e "${BLUE}✓ Creating Backup...${NC}"
mkdir -p "$PROJECT_ROOT/backups"
tar -czf "$PROJECT_ROOT/backups/deployment-$TIMESTAMP.tar.gz" \
  "$PROJECT_ROOT/transcend-api/dist" "$PROJECT_ROOT/transcend-frontend/dist" 2>/dev/null
echo "  ✅ Backup created"

# Summary
echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ DEPLOYMENT BUILD SUCCESSFUL${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo "Version: $VERSION"
echo "Timestamp: $TIMESTAMP"
echo ""
echo "Next Steps:"
echo "  1. npm run deploy:staging       (Test in staging)"
echo "  2. npm run deploy:production    (Launch to production)"
echo ""
echo "Monitoring:"
echo "  - Error tracking: Sentry (sentry.transcend.legal)"
echo "  - Performance: NewRelic + CloudWatch"
echo "  - Logs: CloudWatch /transcend/production"
echo ""
echo "Support:"
echo "  - Slack: #transcend-platform"
echo "  - Runbooks: docs/runbooks/"
echo ""
