#!/usr/bin/env python3
"""
Texas State Bar Attorney Directory - Production Scraper
Objective: Extract 380,000+ attorney records with resumable checkpointing
"""

import asyncio
import csv
import json
import sys
import time
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any, List
import logging
from dataclasses import dataclass, asdict
from enum import Enum

from playwright.async_api import async_playwright, Page, Browser, expect
import aiohttp
from colorama import Fore, Style, init as colorama_init

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("TX_BAR_SCRAPER")
colorama_init(autoreset=True)

# Output directories
SCRATCHPAD = Path("/private/tmp/claude-501/-Users-jbconsultingassociatesinc--code-transcend-ssp/9e95c4e3-aa1f-4687-afed-1131263d4443/scratchpad")
CHECKPOINT_DIR = SCRATCHPAD / "checkpoints"
OUTPUT_DIR = SCRATCHPAD / "output"
LOG_DIR = SCRATCHPAD / "logs"

for d in [CHECKPOINT_DIR, OUTPUT_DIR, LOG_DIR]:
    d.mkdir(parents=True, exist_ok=True)

@dataclass
class Attorney:
    """Attorney record with 17 fields"""
    attorney_id: str
    full_name: str
    state_bar_license_number: str
    specialty_areas: str
    firm_id: Optional[str]
    firm_name: str
    city: str
    county: str
    phone: str
    email: str
    website: str
    bar_admission_year: str
    years_of_experience: str
    bar_status: str
    certifications: str
    certification_expiry: str
    verified_source: str = "State Bar of Texas"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

class BarStatus(Enum):
    ACTIVE = "Active"
    INACTIVE = "Inactive"
    DISCIPLINED = "Disciplined"
    SUSPENDED = "Suspended"

class TexasBarScraper:
    """Production scraper for Texas State Bar attorneys"""

    BASE_URL = "https://www.texasbar.com"
    SEARCH_PAGE = f"{BASE_URL}/AM/Template.cfm?Section=Search"

    def __init__(self, batch_size: int = 50, rate_limit_delay: float = 0.5):
        self.browser: Optional[Browser] = None
        self.page: Optional[Page] = None
        self.batch_size = batch_size
        self.rate_limit_delay = rate_limit_delay
        self.attorneys: List[Attorney] = []
        self.checkpoint_file = CHECKPOINT_DIR / "scraper_checkpoint.json"
        self.output_csv = OUTPUT_DIR / "texas_attorneys.csv"
        self.stats = {
            "total_processed": 0,
            "successful_extractions": 0,
            "failed_extractions": 0,
            "start_time": datetime.now().isoformat(),
            "last_page": 0,
        }

    async def setup(self):
        """Initialize browser"""
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(headless=True)
        self.page = await self.browser.new_page()
        logger.info(f"{Fore.GREEN}✓ Browser initialized{Style.RESET_ALL}")

    async def navigate_to_search(self):
        """Navigate to search page"""
        logger.info(f"Navigating to {self.SEARCH_PAGE}...")
        try:
            await self.page.goto(self.SEARCH_PAGE, wait_until="networkidle")
            await asyncio.sleep(1)
            logger.info(f"{Fore.GREEN}✓ Search page loaded{Style.RESET_ALL}")
        except Exception as e:
            logger.error(f"Navigation failed: {e}")
            raise

    async def analyze_search_results(self) -> int:
        """
        Analyze search page to determine total results and pagination
        Returns: estimated total number of attorneys
        """
        logger.info("Analyzing search results page...")

        try:
            # Look for result count
            result_text = await self.page.inner_text("body")

            # Common patterns for result counts
            import re
            patterns = [
                r'(\d+)\s+(?:results?|records?)',
                r'(?:Showing|Found)\s+(\d+)',
                r'of\s+(\d+)\s+(?:results?|records?)',
                r'Total:\s*(\d+)',
            ]

            estimated_total = None
            for pattern in patterns:
                matches = re.findall(pattern, result_text, re.IGNORECASE)
                if matches:
                    try:
                        estimated_total = int(matches[0])
                        logger.info(f"Found estimated total: {estimated_total}")
                        break
                    except ValueError:
                        continue

            if not estimated_total:
                logger.warning("Could not determine total results count")
                estimated_total = 380000  # Default fallback

            return estimated_total

        except Exception as e:
            logger.error(f"Failed to analyze results: {e}")
            return 380000  # Fallback

    async def extract_attorney_from_row(self, row_element) -> Optional[Attorney]:
        """Extract attorney data from a table row"""
        try:
            # Extract fields from row
            cells = await row_element.query_selector_all("td")

            if len(cells) < 3:
                return None

            # Extract text from cells
            cell_texts = []
            for cell in cells:
                text = await cell.inner_text()
                cell_texts.append(text.strip())

            if not cell_texts:
                return None

            # Parse attorney data (adjust based on actual table structure)
            full_name = cell_texts[0] if len(cell_texts) > 0 else ""
            license_number = cell_texts[1] if len(cell_texts) > 1 else ""
            firm_name = cell_texts[2] if len(cell_texts) > 2 else "Solo Practice"
            city = cell_texts[3] if len(cell_texts) > 3 else ""
            bar_status = cell_texts[4] if len(cell_texts) > 4 else "Active"

            if not full_name or not license_number:
                return None

            attorney = Attorney(
                attorney_id=license_number,
                full_name=full_name,
                state_bar_license_number=license_number,
                specialty_areas="",  # To be filled from detail page if available
                firm_id=None,
                firm_name=firm_name,
                city=city,
                county="",  # To be filled from detail page if available
                phone="",
                email="",
                website="",
                bar_admission_year="",
                years_of_experience="",
                bar_status=bar_status,
                certifications="",
                certification_expiry="",
            )

            return attorney

        except Exception as e:
            logger.debug(f"Failed to extract attorney: {e}")
            return None

    async def extract_page_results(self) -> List[Attorney]:
        """Extract all attorneys from current page"""
        logger.info("Extracting attorneys from page...")

        attorneys = []
        try:
            # Wait for results table
            await self.page.wait_for_selector("table", timeout=5000)

            # Find all table rows (excluding header)
            rows = await self.page.query_selector_all("table tbody tr, table tr:not(:first-child)")

            logger.info(f"Found {len(rows)} rows to process")

            for i, row in enumerate(rows):
                attorney = await self.extract_attorney_from_row(row)
                if attorney:
                    attorneys.append(attorney)
                    logger.debug(f"  [{i+1}] {attorney.full_name} ({attorney.state_bar_license_number})")

                # Rate limiting
                await asyncio.sleep(0.1)

            logger.info(f"{Fore.GREEN}✓ Extracted {len(attorneys)} attorneys from page{Style.RESET_ALL}")

        except Exception as e:
            logger.warning(f"Failed to extract page results: {e}")

        return attorneys

    async def go_to_next_page(self) -> bool:
        """Navigate to next page of results"""
        try:
            # Look for next button
            next_button = await self.page.query_selector("a:has-text('Next'), button:has-text('Next'), a[aria-label*='next'], a[rel='next']")

            if not next_button:
                logger.debug("No next button found")
                return False

            # Check if it's disabled
            next_class = await next_button.get_attribute("class")
            if next_class and 'disabled' in next_class:
                logger.debug("Next button is disabled")
                return False

            logger.info("Navigating to next page...")
            await next_button.click()
            await asyncio.sleep(self.rate_limit_delay)

            # Wait for page to load
            await self.page.wait_for_load_state("networkidle")
            await asyncio.sleep(0.5)

            return True

        except Exception as e:
            logger.debug(f"Failed to navigate to next page: {e}")
            return False

    async def paginate_and_extract(self, max_pages: Optional[int] = None) -> List[Attorney]:
        """
        Paginate through all results and extract attorneys
        """
        all_attorneys = []
        page_count = 0

        logger.info(f"{Fore.YELLOW}Starting pagination (max_pages={max_pages}){Style.RESET_ALL}")

        while True:
            page_count += 1
            logger.info(f"\n{Fore.CYAN}=== Page {page_count} ==={Style.RESET_ALL}")

            # Extract current page
            page_attorneys = await self.extract_page_results()
            all_attorneys.extend(page_attorneys)

            self.stats["total_processed"] += len(page_attorneys)
            self.stats["last_page"] = page_count

            # Save checkpoint
            await self.save_checkpoint(all_attorneys, page_count)

            # Stop if max_pages reached
            if max_pages and page_count >= max_pages:
                logger.info(f"Reached max pages limit ({max_pages})")
                break

            # Try to go to next page
            if not await self.go_to_next_page():
                logger.info("No more pages available")
                break

            # Rate limiting between pages
            await asyncio.sleep(self.rate_limit_delay)

        logger.info(f"\n{Fore.GREEN}Pagination complete: {page_count} pages, {len(all_attorneys)} attorneys{Style.RESET_ALL}")
        return all_attorneys

    async def save_checkpoint(self, attorneys: List[Attorney], page: int):
        """Save progress checkpoint"""
        try:
            checkpoint_data = {
                "timestamp": datetime.now().isoformat(),
                "page": page,
                "attorneys_count": len(attorneys),
                "attorneys": [a.to_dict() for a in attorneys],
                "stats": self.stats,
            }

            with open(self.checkpoint_file, 'w') as f:
                json.dump(checkpoint_data, f, indent=2)

            logger.debug(f"Checkpoint saved at page {page}")

        except Exception as e:
            logger.error(f"Failed to save checkpoint: {e}")

    async def load_checkpoint(self) -> Optional[List[Attorney]]:
        """Load from checkpoint if available"""
        if not self.checkpoint_file.exists():
            return None

        try:
            with open(self.checkpoint_file, 'r') as f:
                data = json.load(f)

            attorneys = [Attorney(**a) for a in data.get("attorneys", [])]
            logger.info(f"{Fore.YELLOW}Loaded checkpoint: {len(attorneys)} attorneys from page {data['page']}{Style.RESET_ALL}")
            return attorneys

        except Exception as e:
            logger.warning(f"Failed to load checkpoint: {e}")
            return None

    async def save_to_csv(self, attorneys: List[Attorney]):
        """Save attorneys to CSV"""
        try:
            fieldnames = [
                "attorney_id", "full_name", "state_bar_license_number",
                "specialty_areas", "firm_id", "firm_name", "city", "county",
                "phone", "email", "website", "bar_admission_year",
                "years_of_experience", "bar_status", "certifications",
                "certification_expiry", "verified_source"
            ]

            with open(self.output_csv, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()

                for attorney in attorneys:
                    writer.writerow(attorney.to_dict())

            logger.info(f"{Fore.GREEN}✓ Saved {len(attorneys)} attorneys to {self.output_csv}{Style.RESET_ALL}")
            logger.info(f"File size: {self.output_csv.stat().st_size / (1024*1024):.2f} MB")

        except Exception as e:
            logger.error(f"Failed to save CSV: {e}")
            raise

    async def run(self, max_pages: Optional[int] = None):
        """Run complete scraper"""
        try:
            await self.setup()
            await self.navigate_to_search()

            # Try to load checkpoint
            attorneys = await self.load_checkpoint()
            if attorneys:
                logger.info(f"Resuming from checkpoint with {len(attorneys)} attorneys")
            else:
                # Start new extraction
                attorneys = await self.paginate_and_extract(max_pages=max_pages)

            # Save to CSV
            await self.save_to_csv(attorneys)

            # Print summary
            logger.info(f"\n{Fore.GREEN}=== SCRAPING SUMMARY ==={Style.RESET_ALL}")
            logger.info(f"Total attorneys extracted: {len(attorneys)}")
            logger.info(f"Pages processed: {self.stats['last_page']}")
            logger.info(f"Output file: {self.output_csv}")

        except Exception as e:
            logger.error(f"Scraper failed: {e}", exc_info=True)
            raise
        finally:
            if self.browser:
                await self.browser.close()
            if self.playwright:
                await self.playwright.stop()

async def main():
    import argparse
    parser = argparse.ArgumentParser(description="Texas State Bar Attorney Directory Scraper")
    parser.add_argument("--max-pages", type=int, help="Maximum pages to scrape (for testing)")
    parser.add_argument("--rate-limit", type=float, default=0.5, help="Delay between requests (seconds)")
    args = parser.parse_args()

    scraper = TexasBarScraper(rate_limit_delay=args.rate_limit)
    await scraper.run(max_pages=args.max_pages)

if __name__ == "__main__":
    asyncio.run(main())
