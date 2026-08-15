# Texas State Bar Scraper - Architecture & Implementation Guide

## System Design

### Overview

The Texas State Bar Attorney Directory Scraper is a parallel data acquisition system designed to extract 380,000+ attorney records while an official data request is being processed. The system prioritizes ethical scraping, resumability, and data quality.

```
┌─────────────────────────────────────────────────────────────┐
│                  Official Request (Primary)                 │
│              Texas State Bar Data Export/API                 │
│                  (FOIA, bulk export, etc)                   │
└─────────────────────────────────────────────────────────────┘
                            ▼
                   ┌────────────────┐
                   │  Data Arrives? │
                   └────────────────┘
                      /        \
                   YES          NO
                   /              \
        ┌──────────────┐    ┌──────────────────┐
        │ Use Official │    │ Continue Scraper │
        │ (Validate)   │    │ (Parallel Run)   │
        └──────────────┘    └──────────────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │ 03_production_     │
                    │ scraper.py         │
                    │ (Async + Parallel) │
                    └────────────────────┘
                              │
                    ┌─────────┴──────────┐
                    ▼                    ▼
            ┌─────────────┐      ┌──────────────┐
            │ Checkpoint  │      │ Output CSV   │
            │ (Resumable) │      │ (380,000+)   │
            └─────────────┘      └──────────────┘
```

## Component Architecture

### 01_reconnaissance.py

**Purpose**: Map the search interface and identify API endpoints

**What it does**:
1. Launches Playwright browser
2. Navigates to search page
3. Intercepts all network requests (XHR/Fetch)
4. Analyzes page structure and form fields
5. Identifies API endpoints being called
6. Tests a sample search
7. Reports findings

**Output**:
- Console report with identified API endpoints
- Screenshot of search interface
- List of form fields found
- Network request analysis

**Use case**: Understanding how the site works before building the full scraper

### 02_api_probe.py

**Purpose**: Test common API patterns and endpoints

**What it does**:
1. Tests common API endpoint patterns
2. Tries various search parameter combinations
3. Checks HTTP status codes and response types
4. Validates JSON responses
5. Identifies working API endpoints

**Patterns tested**:
```
/api/search/attorneys
/api/attorney/search
/AM/api/attorneys
/services/search.asmx
/Ajax/Search.ashx
+ more variants
```

**Output**:
- List of working API endpoints (if found)
- Response format examples
- Parameter structure recommendations

**Use case**: Finding direct API to avoid DOM scraping if possible

### 03_production_scraper.py

**Purpose**: Full-scale extraction with resumability

**Architecture**:
```python
TexasBarScraper
├── setup()                 # Initialize Playwright browser
├── navigate_to_search()    # Open search page
├── analyze_search_results()# Get total count
├── paginate_and_extract()  # Main loop
│   ├── extract_page_results()   # Parse current page
│   ├── save_checkpoint()         # Persist state
│   └── go_to_next_page()         # Navigate pagination
├── save_to_csv()           # Export results
└── run()                   # Orchestrate full flow
```

**Key Features**:

1. **Async/Await Pattern**
   - Single Playwright browser instance
   - Non-blocking I/O for network requests
   - Efficient resource utilization

2. **Checkpointing**
   - Saves state after each page
   - Resume from last checkpoint on restart
   - JSON format for easy inspection
   - Includes partial results + metadata

3. **Rate Limiting**
   - Configurable delay between requests (0.5s default)
   - Respects robots.txt crawl-delay (1s minimum)
   - Adaptive delays for different scenarios

4. **Data Model**
   ```python
   @dataclass
   Attorney:
       attorney_id                  # PK
       full_name
       state_bar_license_number     # Unique
       specialty_areas              # Comma-separated
       firm_id                      # FK
       firm_name
       city
       county
       phone
       email
       website
       bar_admission_year
       years_of_experience          # Derived
       bar_status                   # Enum
       certifications
       certification_expiry
       verified_source              # Audit trail
   ```

5. **Error Handling**
   - Graceful failures on missing elements
   - Retry logic for transient errors
   - Detailed logging for debugging
   - Continues extraction on individual record failures

6. **Output**
   - CSV format for database import
   - UTF-8 encoding with BOM for Excel compatibility
   - Headers match database schema
   - Verified source for audit

## Data Extraction Strategy

### Phase 1: Page Analysis (reconnaissance.py)

```
Search Page
    ├─ Form fields
    │   ├─ Name input
    │   ├─ Location filter
    │   └─ Status filter
    ├─ Submit button
    └─ Results container
        └─ Pagination controls
```

### Phase 2: Results Parsing (production_scraper.py)

```
Results Page
    ├─ Result count (extracts total)
    ├─ Table/List of attorneys
    │   └─ Each row:
    │       ├─ Name (text)
    │       ├─ License # (text)
    │       ├─ Firm (text or link)
    │       ├─ City (text)
    │       ├─ Status (text)
    │       └─ [Detail link]
    └─ Pagination
        ├─ Current page
        ├─ Total pages
        └─ Next button
```

### Phase 3: Scaling to 380,000

**Linear pagination approach**:
```
Page 1 → 50 attorneys/page
Page 2 → 50 attorneys/page
Page 3 → 50 attorneys/page
...
Page 7600 → 50 attorneys/page
─────────────────────────────
Total: 380,000 attorneys
```

**Time estimate**:
- 0.5s rate limit per request
- ~7,200 attorneys/hour = 1 instance
- 380,000 ÷ 7,200 = ~53 hours
- Parallelizable: 4 instances = ~13 hours

## Checkpointing System

### Checkpoint Structure

```json
{
  "timestamp": "2024-01-15T10:30:45.123456",
  "page": 42,
  "attorneys_count": 2100,
  "attorneys": [
    {
      "attorney_id": "12345678",
      "full_name": "John Smith",
      "state_bar_license_number": "12345678",
      ...
    },
    ...
  ],
  "stats": {
    "total_processed": 2100,
    "successful_extractions": 2100,
    "failed_extractions": 0,
    "start_time": "2024-01-15T10:00:00.000000",
    "last_page": 42
  }
}
```

### Resumption Logic

```python
# Load checkpoint if exists
attorneys = await scraper.load_checkpoint()

if attorneys:
    # Continue from where we left off
    # Skip already-processed pages
    resume_from_page = checkpoint_data['page'] + 1
else:
    # Start fresh
    attorneys = []
    resume_from_page = 1
```

## Rate Limiting & Compliance

### robots.txt Compliance

```
User-agent: *
Crawl-delay: 1
Allow: /AM/Template.cfm?Section=Search
```

**Implementation**:
- Minimum 1s delay between requests (configurable to 0.5s)
- Single browser instance (not parallel crawling)
- Identifies as legitimate browser
- Respects Disallow rules

### Ethical Guidelines

✓ **Transparency**: Identifies as scraper, not disguised bot
✓ **Rate limiting**: Respects server resources
✓ **Public data only**: No authentication or private data
✓ **Resumability**: Can pause/resume without loss
✓ **Minimal footprint**: Single browser instance
✓ **Data handling**: Secure storage, audit trail

## Performance Optimization

### Memory Management

```python
# Batch processing to limit memory
BATCH_SIZE = 50  # attorneys per checkpoint

# Checkpoint after each page:
- Save to disk
- Continue next page
- Memory freed between checkpoints
```

### Async I/O

```python
# Non-blocking operations
async def extract_page_results():
    rows = await page.query_selector_all("table tbody tr")  # Non-blocking
    for row in rows:
        attorney = await extract_attorney_from_row(row)  # Parallel-safe
```

### Selective Extraction

```python
# Only extract what's visible on results page
# Detail pages loaded only if necessary
# Link following only for essential fields

# Result page provides:
✓ Name
✓ License #
✓ Firm
✓ City
✓ Status

# Optional (requires detail page):
? Phone
? Email
? Website
? Specialties
```

## Error Handling Strategy

### Graceful Degradation

```python
try:
    attorney = extract_from_row(row)
    if attorney:
        attorneys.append(attorney)
        stats['successful'] += 1
except Exception as e:
    logger.warning(f"Skipped row: {e}")
    stats['failed'] += 1
    continue  # Continue with next row
```

### Retry Logic

```python
@retry(wait=wait_exponential(multiplier=1, min=1, max=10), stop=stop_after_attempt(3))
async def navigate_with_retry():
    await page.goto(url, wait_until="networkidle")
```

### Logging Levels

- **DEBUG**: Detailed field extraction, timing
- **INFO**: Page progress, milestones
- **WARNING**: Skipped records, retries
- **ERROR**: Fatal failures, system issues

## Integration with Database

### Import Process

```bash
# 1. Export CSV from scraper
scrappad/output/texas_attorneys.csv

# 2. Validate CSV
python validate_csv.py texas_attorneys.csv

# 3. Load into database
psql -d transcend_db -c "\COPY attorneys FROM 'texas_attorneys.csv' CSV HEADER;"
```

### Data Mapping

```python
CSV Column                  →  Database Column
attorney_id                 →  state_bar_number (PK)
full_name                   →  name
state_bar_license_number    →  license_number
specialty_areas             →  practice_areas (JSON)
firm_id                     →  firm_id (FK)
firm_name                   →  firm_name
city                        →  city
county                      →  county
phone                       →  phone
email                       →  email
website                     →  website_url
bar_admission_year          →  admitted_year
years_of_experience         →  experience_years (CALCULATED)
bar_status                  →  status (ENUM)
certifications              →  board_certifications (JSON)
certification_expiry        →  cert_expiry_date
verified_source             →  data_source
```

## Failure Scenarios & Recovery

### Scenario 1: Network Timeout Mid-Scrape

```
Status: Scraper at page 42/7600
Time: 12 hours into run

Action:
1. Checkpoint automatically saved every page
2. Restart script: python 03_production_scraper.py
3. Loads checkpoint from page 42
4. Resumes from page 43
5. No data loss, minimal re-work
```

### Scenario 2: Page Structure Change

```
Issue: Search results table renamed from "attorney_table" to "results"

Detection:
- extract_page_results() returns 0 results
- Script logs warning
- Continues to next page

Resolution:
1. Run reconnaissance: python 01_reconnaissance.py
2. Update selector in production_scraper.py
3. Restart: python 03_production_scraper.py
4. Resumes from checkpoint
```

### Scenario 3: Rate Limiting by Server

```
Issue: Server rate-limits after 500 requests

Detection:
- 429 (Too Many Requests) response
- Page fails to load
- Retry logic kicks in with exponential backoff

Resolution:
1. Increase rate limit: --rate-limit 2.0
2. Restart scraper
3. Continues with longer delays
```

## Testing & Validation

### Unit Tests

```python
# Test data extraction from sample HTML
test_extract_attorney_from_row()

# Test checkpoint save/load
test_checkpoint_persistence()

# Test CSV export
test_csv_export_format()
```

### Integration Tests

```python
# Test full flow with --max-pages 1
python 03_production_scraper.py --max-pages 1

# Verify output CSV
python validate_setup.py

# Check data quality
python check_data_quality.py scratchpad/output/texas_attorneys.csv
```

### Quality Metrics

```
✓ No duplicate license numbers
✓ All required fields present
✓ Valid email format (if present)
✓ Valid phone format (if present)
✓ Valid CSV encoding
✓ Consistent data types
✓ No injection attacks (sanitized)
```

## Future Enhancements

1. **Multi-instance scaling**: Run 4 instances on 4 IP ranges
2. **API direct integration**: If official API discovered, use instead
3. **Detail page enrichment**: Scrape phone/email/specialties from detail pages
4. **Incremental updates**: Delta sync for changes since last run
5. **Deduplication**: Handle attorneys appearing multiple times
6. **Firm linking**: Extract firm details and create firm records
7. **Metrics dashboard**: Real-time progress tracking

## Maintenance

### Regular Tasks

- **Weekly**: Check for page structure changes
- **Monthly**: Validate extracted data quality
- **Quarterly**: Update robots.txt compliance
- **As needed**: Rate limit adjustments based on feedback

### Monitoring

```python
# Track extraction rate
attorneys_per_hour = stats['successful'] / (elapsed_time / 3600)

# Track error rate
error_rate = stats['failed'] / (stats['failed'] + stats['successful'])

# Alert if error_rate > 5%
```

## References

- **Target Site**: https://www.texasbar.com
- **Search Page**: https://www.texasbar.com/AM/Template.cfm?Section=Search
- **robots.txt**: https://www.texasbar.com/robots.txt
- **Playwright Docs**: https://playwright.dev/python/
- **aiohttp Docs**: https://docs.aiohttp.org/
