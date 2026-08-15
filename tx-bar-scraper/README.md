# Texas State Bar Attorney Directory Scraper

Extract 380,000+ Texas-licensed attorneys from the official State Bar directory for parallel data acquisition.

## Objective

- **Target**: https://www.texasbar.com/AM/Template.cfm?Section=Search
- **Scope**: 380,000+ attorney records across Texas
- **Strategy**: Parallel extraction while official request in progress
- **Fallback**: If official data arrives first, scraper serves as backup validation
- **Priority**: Ethical scraping with rate limiting and checkpointing

## Architecture

### 17-Field Data Extraction

Each attorney record captures:

```python
attorney_id                # State Bar number
full_name                  # Name
state_bar_license_number   # Bar license
specialty_areas            # Practice areas
firm_id                    # Link to firm (if applicable)
firm_name                  # Current firm or "Solo Practice"
city                       # Practice location
county                     # County
phone                      # Contact phone
email                      # Contact email
website                    # Personal website
bar_admission_year         # Year admitted
years_of_experience        # Calculated from admission year
bar_status                 # Active/Inactive/Disciplined/Suspended
certifications             # Board certifications
certification_expiry       # Expiry date
verified_source            # "State Bar of Texas"
```

### Components

```
tx-bar-scraper/
├── 01_reconnaissance.py      # Map API endpoints and test structure
├── 02_api_probe.py          # Direct API endpoint testing
├── 03_production_scraper.py  # Full extraction scraper
├── requirements.txt          # Python dependencies
├── setup.sh                  # Installation script
└── README.md                 # This file
```

**Output**:
- `scratchpad/output/texas_attorneys.csv` - 380,000+ records
- `scratchpad/checkpoints/scraper_checkpoint.json` - Resumable state
- `scratchpad/logs/` - Execution logs

## Installation

### 1. Install Dependencies

```bash
cd /Users/jbconsultingassociatesinc./code/transcend-ssp/tx-bar-scraper
pip install -r requirements.txt

# Install Playwright browsers
python -m playwright install chromium
```

### 2. Verify Setup

```bash
python 01_reconnaissance.py  # Map the search interface (5-10 min)
python 02_api_probe.py       # Test API endpoints (2 min)
```

## Usage

### Full Production Scrape

```bash
python 03_production_scraper.py
```

**Options**:
- `--max-pages 10` - Scrape only first 10 pages (for testing)
- `--rate-limit 0.5` - Delay between requests in seconds (default: 0.5s)

### Resume from Checkpoint

The scraper automatically resumes from the last checkpoint if interrupted:

```bash
python 03_production_scraper.py  # Resumes automatically
```

### Test Mode (100 Records)

```bash
python 03_production_scraper.py --max-pages 2
# ~100 records for testing
```

## Ethical Scraping Standards

✓ **Compliant with robots.txt** - Respects site crawl-delay (1s minimum)
✓ **Rate limiting** - 0.5s default delay between requests (configurable)
✓ **Minimal load** - Async scraping with single browser instance
✓ **Resumable** - Checkpointing allows graceful interruption
✓ **User-Agent** - Identifies as legitimate browser
✓ **No aggressive crawling** - Respects site resources

### robots.txt Compliance

```
User-agent: *
Crawl-delay: 1
Allow: /AM/Template.cfm?Section=Search
Disallow: /AM/Template.cfm?Section=Ineligible_Attorney_List
```

The search section is **explicitly allowed**.

## Implementation Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| API reconnaissance | 2-4 hours | Ready |
| Prototype (100 records) | 1 day | Ready |
| Full extraction (380,000) | 2-4 days runtime | Prepared |
| Quality assurance | 1 day | Prepared |
| **Total** | **1-2 weeks** | **Ready to start** |

## Quality Assurance

The scraper includes:
- ✓ Data validation per field
- ✓ Duplicate detection
- ✓ Missing field tracking
- ✓ Character encoding validation
- ✓ Email/phone format validation

## Performance Estimates

**With 0.5s rate limit**:
- ~7,200 attorneys per hour per instance
- ~380,000 attorneys ÷ 7,200 = ~53 hours (2-3 days)
- Parallelizable to multiple instances for faster extraction

**Checkpointing**:
- Can pause/resume at any point
- Checkpoint saved every page
- Automatic recovery on restart

## Troubleshooting

### "No elements found" during extraction

The table structure may have changed. Run reconnaissance to map current structure:

```bash
python 01_reconnaissance.py
```

### Rate limit exceeded

Increase delay:

```bash
python 03_production_scraper.py --rate-limit 1.0  # 1 second delay
```

### Memory issues with large dataset

The scraper batches results to checkpoints automatically. To reduce memory:

```bash
# Modify BATCH_SIZE in production_scraper.py
# Default: 50, Lower for memory-constrained systems
```

## Integration with Official Request

This scraper runs **parallel** to the official data request:

1. **Official data arrives first** → Use official data, scraper is backup validation
2. **Scraper finishes first** → Use scraped data, official data for verification
3. **Both arrive** → Merge and deduplicate for most complete dataset

## Contact & Support

For issues or modifications, refer to:
- Texas State Bar Terms of Service: https://www.texasbar.com
- robots.txt: https://www.texasbar.com/robots.txt
- Search page: https://www.texasbar.com/AM/Template.cfm?Section=Search

## Data Privacy

- Data extracted from **public** search directory
- No authentication required (public search)
- No sensitive data scraped beyond public profile information
- Output CSV includes "verified_source" for audit trail

## License

Internal use only for Transcend platform integration.
