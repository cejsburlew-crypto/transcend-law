# Real Data Integration Guide - Live Firm & Notary Counts

## Overview

The Transcend Law platform now displays real counts of law firms and notaries on service cards, with data automatically refreshing every hour from CSV files.

## System Architecture

### Backend Services

#### 1. Law Firm Stats Service (`lawFirmStats.ts`)
- Loads all law firm CSV files from project root
- Aggregates firms by practice area using keyword matching
- Counts total firms, attorneys, and states per specialty
- Returns structured statistics

**CSV Files Supported:**
- `*-law-firms.csv` (e.g., california-law-firms.csv, texas-law-firms.csv)
- `*_firms.csv` (e.g., michigan_firms.csv)

**Required CSV Columns:**
```
firm_id, firm_name, city, county, state, practice_areas, 
year_founded, estimated_attorney_count, phone, website, verified_source
```

#### 2. Notary Stats Service (`notaryStats.ts`)
- Loads all notary CSV files from project root
- Aggregates notaries by state and specialty
- Returns remote availability metrics
- Tracks top states by notary density

**CSV Files Supported:**
- `*notar*.csv` (e.g., notaries-all-states.csv)

**Required CSV Columns:**
```
notary_id, name, city, county, state, specialties, 
phone, website, remote_available, commission_expiry, verified_source
```

#### 3. Data Refresh Scheduler (`dataRefreshScheduler.ts`)
- Runs on server startup
- Automatically refreshes stats every 1 hour
- Logs refresh activity to console
- Can be configured or triggered manually

### Frontend Integration

#### 1. Law Specialties Component (`LawSpecialties.tsx`)
- Fetches real stats on component mount via `/api/v1/law-firms/stats`
- Displays counts: States, Firms, Attorneys
- Falls back to default data if API unavailable
- Shows loading state during fetch

#### 2. Notary Stats Component (`NotaryStats.tsx`)
- Displays aggregate notary metrics
- Shows remote availability percentage
- Lists top 10 states by notary count
- Last update timestamp

## API Endpoints

### Law Firm Statistics

**GET /api/v1/law-firms/stats**
```json
{
  "success": true,
  "data": {
    "corporate": {
      "firmsCount": 2847,
      "attorneysCount": 8294,
      "statesAvailable": 50
    },
    // ... more specialties
  },
  "lastUpdate": "2026-08-14T20:32:00.000Z"
}
```

**GET /api/v1/law-firms/stats/:specialtyId**
```json
{
  "success": true,
  "data": {
    "firmsCount": 2847,
    "attorneysCount": 8294,
    "statesAvailable": 50
  },
  "lastUpdate": "2026-08-14T20:32:00.000Z"
}
```

**POST /api/v1/law-firms/stats/refresh**
- Forces immediate refresh of law firm statistics
- Useful for testing after importing new data

### Notary Statistics

**GET /api/v1/notaries/stats**
```json
{
  "success": true,
  "data": {
    "totalNotaries": 12345,
    "remoteNotaries": 5678,
    "statesCovered": 50,
    "specialtyBreakdown": {
      "General Notary": 8900,
      "E-Notary": 2145,
      "Electronic Notary": 2300
    },
    "topStates": [
      { "state": "CA", "count": 2345 },
      { "state": "TX", "count": 1890 }
      // ... top 10 states
    ]
  },
  "lastUpdate": "2026-08-14T20:32:00.000Z"
}
```

**POST /api/v1/notaries/stats/refresh**
- Forces immediate refresh of notary statistics

## Deployment Steps

### 1. Install Dependencies
```bash
cd /Users/jbconsultingassociatesinc./code/transcend-ssp
npm install
# or if using yarn workspaces
yarn install
```

### 2. Prepare Data Files

**Law Firms:**
Place all law firm CSV files in the project root:
```
/Users/jbconsultingassociatesinc./code/transcend-ssp/
├── california-law-firms.csv
├── texas-law-firms.csv
├── michigan_firms.csv
└── ... other states
```

**Notaries:**
Create notary CSV files in the project root:
```
/Users/jbconsultingassociatesinc./code/transcend-ssp/notaries-all-states.csv
```

### 3. Start Backend Server

#### Option A: Direct Node
```bash
cd transcend-law/backend
npm run dev
# Runs on http://localhost:3000
```

#### Option B: From Root (Yarn Workspaces)
```bash
yarn workspace transcend-law/backend dev
# Runs on http://localhost:3000
```

### 4. Start Frontend Server

#### Option A: Direct
```bash
cd transcend-frontend
npm run dev
# Runs on http://localhost:5173
```

#### Option B: From Root (Yarn Workspaces)
```bash
yarn workspace transcend-frontend dev
# Runs on http://localhost:5173
```

### 5. Verify Setup

**Check backend is running:**
```bash
curl http://localhost:3000/health
# Response: {"status":"ok","timestamp":"2026-08-14T20:32:00.000Z"}
```

**Check law firm stats:**
```bash
curl http://localhost:3000/api/v1/law-firms/stats | jq .
```

**Check notary stats:**
```bash
curl http://localhost:3000/api/v1/notaries/stats | jq .
```

**Access frontend:**
- Navigate to http://localhost:5173
- Go to Legal Specialties page
- Cards should display real firm counts from CSV data

## Importing New Data

### Adding Law Firms
1. Place new CSV file in project root with naming pattern `*-law-firms.csv` or `*_firms.csv`
2. Ensure CSV has required columns
3. Either wait for hourly refresh or trigger manual refresh:
   ```bash
   curl -X POST http://localhost:3000/api/v1/law-firms/stats/refresh
   ```
4. Frontend will fetch updated data on next page refresh

### Adding Notaries
1. Place new CSV file in project root with name containing "notar"
2. Ensure CSV has required columns
3. Trigger refresh:
   ```bash
   curl -X POST http://localhost:3000/api/v1/notaries/stats/refresh
   ```

## Customizing Refresh Interval

Default: 1 hour (3,600,000ms)

To change in production:
- Modify `refreshIntervalMs` in `dataRefreshScheduler.ts`
- Minimum: 60,000ms (1 minute)

Example: Change to 30 minutes
```typescript
// dataRefreshScheduler.ts
private refreshIntervalMs: number = 1800000; // 30 minutes
```

## Troubleshooting

### Law Firm Stats Show 0 Counts
1. Verify CSV files exist in project root with correct naming
2. Check CSV column headers match expected schema
3. Manually trigger refresh: `curl -X POST http://localhost:3000/api/v1/law-firms/stats/refresh`
4. Check server logs for errors

### Notary Stats Not Appearing
1. Ensure notary CSV files exist in project root
2. Filename must contain "notar" (e.g., notaries.csv, notary-data.csv)
3. Verify required columns in CSV
4. Check `/api/v1/notaries/stats` endpoint responds with data

### Frontend Shows Default Data Instead of Real Data
1. Check that backend is running on port 3000
2. Verify Vite proxy configuration in `vite.config.ts`
3. Check browser console for network errors to `/api/v1/law-firms/stats`
4. Hard reload browser (Cmd+Shift+R)

### Refresh Not Working
1. Check backend server logs for errors
2. Verify CSV files have correct formatting
3. Check file permissions on CSV files
4. Ensure practice_areas and other key fields are not empty

## Performance Notes

- Initial load: ~5-10 seconds (loads all CSV files into memory)
- Refresh (hourly): ~2-3 seconds
- API response time: <100ms (cached data)
- Memory usage: ~50-100MB for 6,000+ firms

## Future Enhancements

- Database persistence instead of in-memory cache
- CSV import API endpoint
- Data validation and cleanup
- Pagination for large datasets
- Search/filter capabilities
- Historical data tracking
- Email notifications on data updates
