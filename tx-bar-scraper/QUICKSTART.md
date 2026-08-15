# Quick Start Guide - Texas State Bar Scraper

## 🚀 Get Started in 5 Minutes

### Step 1: Install Dependencies (2 min)

```bash
cd /Users/jbconsultingassociatesinc./code/transcend-ssp/tx-bar-scraper

# Run setup script
bash setup.sh

# This installs:
# ✓ Python dependencies (playwright, aiohttp, pandas, etc)
# ✓ Playwright chromium browser
# ✓ Creates output directories
```

### Step 2: Validate Setup (1 min)

```bash
python validate_setup.py
```

Expected output:
```
✓ Python Version          3.11.7
✓ Playwright              1.45.0
✓ aiohttp                 3.9.5
✓ Playwright Chromium     installed
✓ Output Directories      4 items
✓ Target URLs             2 items
✓ Disk Space              150.3 GB available

All checks passed! ✓
```

### Step 3: Test the Scraper (30 sec - 2 min)

```bash
# Extract first 2 pages (~100 attorneys) for testing
python 03_production_scraper.py --max-pages 2
```

Expected output:
```
2024-01-15 10:30:45 - ✓ Browser initialized
2024-01-15 10:30:48 - Navigating to https://www.texasbar.com/AM/Template.cfm?Section=Search...
2024-01-15 10:30:52 - ✓ Search page loaded
2024-01-15 10:31:05 - === Page 1 ===
2024-01-15 10:31:08 - ✓ Extracted 50 attorneys from page
2024-01-15 10:31:10 - === Page 2 ===
2024-01-15 10:31:13 - ✓ Extracted 50 attorneys from page

=== SCRAPING SUMMARY ===
Total attorneys extracted: 100
Pages processed: 2
Output file: scratchpad/output/texas_attorneys.csv
```

### Step 4: Run Full Scraper (2-4 days)

```bash
# Extract all 380,000+ attorneys
python 03_production_scraper.py

# Process will:
# ✓ Scrape ~7,200 attorneys/hour
# ✓ Save checkpoint after each page
# ✓ Run continuously (can Ctrl+C to pause)
# ✓ Resume from last checkpoint on restart
```

---

## 📊 Output File

After scraping, you'll have:

**File**: `scratchpad/output/texas_attorneys.csv`

**Format**: CSV with 17 columns

```csv
attorney_id,full_name,state_bar_license_number,specialty_areas,firm_id,firm_name,city,county,phone,email,website,bar_admission_year,years_of_experience,bar_status,certifications,certification_expiry,verified_source
12345678,John Smith,12345678,"Civil Law,Business",f001,Smith Law Firm,Austin,Travis,512-555-1234,john@smithlaw.com,smithlaw.com,2010,14,Active,"Board Certified - Civil",2026-12-31,State Bar of Texas
...
```

**Size**: ~380,000 rows = 50-100 MB CSV

---

## 🔄 Resuming After Interruption

If the scraper is interrupted (Ctrl+C, network issue, etc.):

```bash
# Simply restart - it auto-resumes from checkpoint
python 03_production_scraper.py

# Will:
# ✓ Load checkpoint from last page processed
# ✓ Skip already-extracted attorneys
# ✓ Continue from next page
# ✓ No data loss!
```

---

## ⚙️ Advanced Options

```bash
# Scrape with longer delays (for rate limiting)
python 03_production_scraper.py --rate-limit 1.0

# Scrape first 10 pages only
python 03_production_scraper.py --max-pages 10

# Combine options
python 03_production_scraper.py --max-pages 5 --rate-limit 0.8
```

---

## 🔍 What Each Script Does

| Script | Purpose | Runtime | Use When |
|--------|---------|---------|----------|
| `01_reconnaissance.py` | Map the site structure | 5-10 min | First time, or if site changes |
| `02_api_probe.py` | Test for API endpoints | 2 min | To check for faster extraction method |
| `03_production_scraper.py` | Extract attorneys | 2-4 days | Ready to scrape all data |
| `validate_setup.py` | Check dependencies | 30 sec | Before first run |

---

## 📈 Performance

**Extraction Rate**: ~7,200 attorneys/hour per instance

**Timeline for 380,000 attorneys**:
- Single instance: ~53 hours (2-3 days)
- No external factors: 2-4 days total
- Can be parallelized: 4 instances = ~13 hours

**Rate Limit**: 0.5 seconds between pages (configurable)
- Respects robots.txt crawl-delay
- Won't overload the server
- Safe for long-running scrapes

---

## 🛠️ Troubleshooting

### "Module not found" errors

```bash
# Reinstall dependencies
pip install -r requirements.txt
python -m playwright install chromium
```

### "Can't find search results" errors

The page structure may have changed. Update it:

```bash
# Analyze current structure
python 01_reconnaissance.py

# Then update selector in 03_production_scraper.py
# See ARCHITECTURE.md for details
```

### Connection timeouts

The website may be rate limiting. Increase delays:

```bash
python 03_production_scraper.py --rate-limit 2.0  # 2 second delay
```

### Out of memory

Reduce batch size in `03_production_scraper.py`:

```python
BATCH_SIZE = 25  # Instead of 50
```

---

## 📝 Integration with Database

After scraping completes:

```bash
# 1. Validate CSV
python validate_csv.py scratchpad/output/texas_attorneys.csv

# 2. Import to database
psql -d transcend_db -c "\COPY attorneys FROM 'scratchpad/output/texas_attorneys.csv' CSV HEADER"

# 3. Verify counts
psql -d transcend_db -c "SELECT COUNT(*) FROM attorneys"
```

---

## 🌐 URLs Reference

- **Search Page**: https://www.texasbar.com/AM/Template.cfm?Section=Search
- **robots.txt**: https://www.texasbar.com/robots.txt
- **State Bar Home**: https://www.texasbar.com

---

## 📞 Support

### For setup issues
- Run: `python validate_setup.py`
- Check: README.md and ARCHITECTURE.md

### For scraping issues
- Check logs in: `scratchpad/logs/`
- Review checkpoint: `scratchpad/checkpoints/scraper_checkpoint.json`
- Refer to ARCHITECTURE.md - Troubleshooting section

### For data issues
- Validate CSV: `python validate_csv.py output.csv`
- Check data quality report in logs

---

## ✅ Pre-Flight Checklist

Before starting full scrape:

- [ ] Ran `setup.sh` successfully
- [ ] Ran `validate_setup.py` - all checks passed
- [ ] Tested with `--max-pages 2` - extracted ~100 records
- [ ] Verified CSV output file created
- [ ] Confirmed disk space available (1+ GB)
- [ ] Reviewed rate limits are acceptable
- [ ] Ready for 2-4 day run

---

## 🎯 Next Steps

1. **Now**: Run `python 03_production_scraper.py --max-pages 2` (test)
2. **Then**: Monitor output in `scratchpad/output/texas_attorneys.csv`
3. **Finally**: Run `python 03_production_scraper.py` (full extraction)

**Estimated completion**: Within 1-2 weeks ✓
