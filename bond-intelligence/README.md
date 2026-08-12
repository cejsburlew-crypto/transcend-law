# Bond Intelligence Scraper — Transcend PM

Capital program opportunity engine. Identifies public agencies (K-12 districts, community colleges, cities, counties, special districts) with recent bond funding across CA, TX, FL, AZ, OR, WA, CO, MI, and NY.

## Architecture

```
bond-intelligence/
├── api/          — CodeIgniter 4 PHP REST API (backend)
├── dashboard/    — Angular 17 dashboard (frontend)
└── scraper/      — Python scrapers + pipeline
```

---

## Quick Start

### 1. PHP Backend API

**Requirements:** PHP 8.1+, Composer

```bash
cd api
composer install

# Copy environment file
cp env .env
# Edit .env if needed — SQLite is zero-config by default

# Run database migrations
php spark migrate

# Seed with sample data (11 agencies, bonds, procurements)
php spark db:seed BondIntelligenceSeeder

# Score all seeded agencies
php spark score:all 2>/dev/null || true   # optional custom command (or use Python scorer)

# Start the development server on port 8080
php spark serve --port=8080
```

API base URL: `http://localhost:8080/api/v1`

Key endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard/summary` | KPI cards + top opportunities |
| GET | `/leads` | Paginated lead list with filters |
| GET | `/agencies` | Agency list with scores |
| GET | `/agencies/{id}` | Full agency detail (7 tabs) |
| GET | `/procurement` | Active RFQs |
| GET | `/scrape-runs` | Scraper run history |
| GET | `/export/csv` | Full CSV export (23 columns) |
| GET | `/export/crm` | HubSpot-ready CSV |
| POST | `/scrape-runs/trigger` | Queue a scrape run |

---

### 2. Angular Dashboard

**Requirements:** Node.js 18+, npm

```bash
cd dashboard
npm install
npm start
```

Open `http://localhost:4200`

To build for production:
```bash
npm run build
# Output in dist/dashboard/
```

---

### 3. Python Scrapers

**Requirements:** Python 3.11+

```bash
cd scraper
python -m venv .venv
source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Install Playwright browser (needed for dynamic pages)
playwright install chromium

# Copy env file
cp .env.example .env
# Edit .env — set DB_PATH to point at the CI4 SQLite file:
#   DB_PATH=../api/writable/bond_intelligence.db

# Initialise the database (creates tables if not already created by PHP)
python main.py db init

# Run a single scraper
python main.py scrape --source cdiac
python main.py scrape --source tx_brb
python main.py scrape --source ballotpedia
python main.py scrape --source procurement
python main.py scrape --source all          # all scrapers

# Dry run (prints without saving)
python main.py scrape --source cdiac --dry-run

# Re-score all agencies after scraping
python main.py score

# Score a single agency
python main.py score --agency-id 3

# Database management
python main.py db stats       # row counts
python main.py db dedup       # merge near-duplicate agencies

# Start the scheduled daemon (runs weekly + daily)
python scheduler.py
```

**Schedule (Pacific Time):**
- CDIAC (CA) — every Monday 02:00
- CA Elections — every Monday 02:30
- TX BRB — every Monday 03:00
- Ballotpedia — every Monday 04:00
- Procurement portals — every day 01:00

---

## Lead Scoring

Scores range 0–100. Tiers:

| Tier | Range | Color |
|------|-------|-------|
| Hot  | ≥ 70  | Red   |
| Warm | ≥ 50  | Orange |
| Cool | ≥ 30  | Blue  |
| Cold | < 30  | Grey  |

**`approach_now`** = score ≥ 70 AND stage is `bond_passed`, `rfq_expected`, or `rfq_active`.

Key scoring factors:
- Bond passed within 12 months: **+40**
- Bond passed within 24 months: **+25**
- Bond amount > $500M: **+20**
- Unissued ratio > 50%: **+10**
- Active RFQ/RFP: **+15**
- No program manager on record: **+10**
- All consultant roles filled: **−15**
- Stale source documents: **−10**

---

## Data Sources

| Source | Coverage | Scraper |
|--------|----------|---------|
| CA CDIAC / DebtWatch | CA K-14 bonds, issuances, authorized/unissued | `cdiac_scraper.py` |
| CA Secretary of State | Local bond election results | `ca_election_scraper.py` |
| Texas Bond Review Board | TX local bond elections + issuances | `tx_brb_scraper.py` |
| Ballotpedia | Multi-state bond measure results | `ballotpedia_scraper.py` |
| PlanetBids, BidNet | Procurement solicitations | `procurement_scraper.py` |

**Polite scraping policy:**
- 2-second delay between requests
- Respects `robots.txt`
- User-Agent: `BondIntelligenceScraper/1.0 (Transcend PM research tool; contact: jim.burlew@jbca-inc.com)`

---

## Opportunity Stages

| Stage | Description |
|-------|-------------|
| `bond_passed` | Bond passed, no PM on record yet |
| `bond_failed_retry` | Bond failed — monitor next cycle |
| `rfq_expected` | Pending bond — procurement imminent |
| `rfq_active` | Active RFQ or RFP in market |
| `consultant_awarded` | PM awarded, gaps may exist |
| `construction_active` | Construction underway |
| `closeout` | Program winding down |

---

## Export Formats

**Full CSV** (`/api/v1/export/csv`) — 23 columns including all bond data, scores, outreach angles, and next actions.

**HubSpot CRM CSV** (`/api/v1/export/crm`) — 14 columns mapped to HubSpot Company fields: Company Name, Website, Industry, Annual Revenue (bond amount), Lead Status (Hot/Warm/Cold), Description.

Both support query filters: `?state=CA&opportunity_stage=bond_passed&min_score=50&approach_now=1`

---

## Development Notes

- **Database:** SQLite3 at `api/writable/bond_intelligence.db` (shared by PHP API and Python scrapers via `DB_PATH` env var)
- **CORS:** Enabled for `localhost:4200` via `app/Filters/CorsFilter.php`
- **Brand colors:** Navy `#0a1628`, Gold `#c9a84c`
- **Angular API URL:** Configured in `dashboard/src/environments/environment.ts`

---

## Estimated Timeline (from scratch)

| Phase | Time |
|-------|------|
| Initial setup + migrations | 1–2 hrs |
| First scraper run (CDIAC) | 30 min |
| Full historical scrape (all sources) | 4–6 hrs |
| Manual data review + QA | 2–4 hrs |
| Dashboard live with real data | 8–12 hrs total |

Weekly maintenance after that: ~30 min (review new scrape runs, action hot leads).
