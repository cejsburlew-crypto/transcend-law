#!/usr/bin/env python3
"""
Texas State Bar Attorney Directory - Reconnaissance Scraper
Objective: Map the search API and extract sample data to understand structure
"""

import asyncio
import json
import sys
from pathlib import Path
from typing import Optional, Dict, Any
import logging

from playwright.async_api import async_playwright, Page, Browser
from colorama import Fore, Style, init as colorama_init

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("TX_BAR_RECON")
colorama_init(autoreset=True)

class TexasBarReconnaissance:
    """Reconnaissance phase - map API and capture sample data"""

    BASE_URL = "https://www.texasbar.com"
    SEARCH_PAGE = f"{BASE_URL}/AM/Template.cfm?Section=Search"

    def __init__(self):
        self.browser: Optional[Browser] = None
        self.page: Optional[Page] = None
        self.captured_requests = []
        self.api_endpoint: Optional[str] = None
        self.sample_data = []

    async def setup(self):
        """Initialize browser and page"""
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(headless=True)
        self.page = await self.browser.new_page()

        # Capture network requests
        async def handle_route(route):
            request = route.request
            method = request.method
            url = request.url

            # Log XHR/Fetch requests
            if request.resource_type in ["xhr", "fetch"]:
                logger.info(f"{Fore.CYAN}[API] {method} {url}{Style.RESET_ALL}")
                self.captured_requests.append({
                    "url": url,
                    "method": method,
                    "timestamp": str(__import__('datetime').datetime.now())
                })

                # Try to capture response
                try:
                    response = await route.fetch()
                    response_text = await response.text()
                    if response_text and len(response_text) < 10000:
                        logger.debug(f"Response: {response_text[:500]}")
                    await route.continue_()
                except Exception as e:
                    logger.warning(f"Failed to capture response: {e}")
                    await route.continue_()
            else:
                await route.continue_()

        await self.page.route("**/*", handle_route)
        logger.info(f"{Fore.GREEN}✓ Browser setup complete{Style.RESET_ALL}")

    async def navigate_to_search(self):
        """Navigate to search page"""
        logger.info(f"{Fore.YELLOW}Navigating to {self.SEARCH_PAGE}...{Style.RESET_ALL}")
        try:
            await self.page.goto(self.SEARCH_PAGE, wait_until="networkidle", timeout=30000)
            logger.info(f"{Fore.GREEN}✓ Search page loaded{Style.RESET_ALL}")

            # Wait for page to stabilize
            await asyncio.sleep(2)

            # Take screenshot for debugging
            screenshot_path = Path("/private/tmp/claude-501/-Users-jbconsultingassociatesinc--code-transcend-ssp/9e95c4e3-aa1f-4687-afed-1131263d4443/scratchpad/search_page.png")
            await self.page.screenshot(path=str(screenshot_path))
            logger.info(f"Screenshot saved: {screenshot_path}")

        except Exception as e:
            logger.error(f"Failed to navigate: {e}")
            raise

    async def analyze_page(self):
        """Analyze page structure and find input fields"""
        logger.info(f"{Fore.YELLOW}Analyzing page structure...{Style.RESET_ALL}")

        # Get page title and h1
        title = await self.page.title()
        logger.info(f"Page title: {title}")

        # Look for search form
        search_form = await self.page.query_selector("form")
        if search_form:
            logger.info(f"{Fore.GREEN}✓ Found search form{Style.RESET_ALL}")

            # Get all input fields
            inputs = await self.page.query_selector_all("input, select, textarea")
            logger.info(f"Found {len(inputs)} form fields:")
            for i, inp in enumerate(inputs):
                inp_type = await inp.get_attribute("type")
                inp_name = await inp.get_attribute("name")
                inp_id = await inp.get_attribute("id")
                logger.info(f"  [{i}] type={inp_type}, name={inp_name}, id={inp_id}")

        # Look for search buttons
        buttons = await self.page.query_selector_all("button, input[type='submit']")
        logger.info(f"Found {len(buttons)} buttons")

    async def test_search(self, query: str = ""):
        """Test a search to capture API requests"""
        logger.info(f"{Fore.YELLOW}Attempting test search...{Style.RESET_ALL}")

        try:
            # Look for search button and click it
            search_button = await self.page.query_selector("button:has-text('Search'), input[value*='Search'], input[value*='search']")

            if search_button:
                # Clear captured requests before search
                self.captured_requests = []

                logger.info("Clicking search button...")
                await search_button.click()

                # Wait for API calls
                await asyncio.sleep(3)

                # Analyze captured requests
                if self.captured_requests:
                    logger.info(f"{Fore.GREEN}✓ Captured {len(self.captured_requests)} API requests:{Style.RESET_ALL}")
                    for req in self.captured_requests:
                        logger.info(f"  - {req['url']}")
                        if 'api' in req['url'].lower() or 'json' in req['url'].lower():
                            self.api_endpoint = req['url']
                            logger.info(f"{Fore.CYAN}[API ENDPOINT] {self.api_endpoint}{Style.RESET_ALL}")
            else:
                logger.warning("Could not find search button")

        except Exception as e:
            logger.error(f"Search test failed: {e}")

    async def extract_results(self):
        """Extract search results from page"""
        logger.info(f"{Fore.YELLOW}Extracting results...{Style.RESET_ALL}")

        try:
            # Wait for results table
            results = await self.page.query_selector_all("table tr, [class*='result'], [class*='row']")
            logger.info(f"Found {len(results)} result elements")

            # Try to get any attorney data visible on page
            text = await self.page.inner_text("body")

            # Look for common attorney name patterns or license numbers
            import re
            license_pattern = r'\b\d{6,7}\b'  # Texas bar numbers are typically 6-7 digits
            matches = re.findall(license_pattern, text)
            logger.info(f"Found {len(set(matches))} potential license numbers")

        except Exception as e:
            logger.error(f"Failed to extract results: {e}")

    async def run(self):
        """Run reconnaissance"""
        try:
            await self.setup()
            await self.navigate_to_search()
            await self.analyze_page()
            await self.test_search()
            await self.extract_results()

            # Summary
            logger.info(f"\n{Fore.GREEN}=== RECONNAISSANCE SUMMARY ==={Style.RESET_ALL}")
            logger.info(f"API Endpoint: {self.api_endpoint or 'Not found'}")
            logger.info(f"Captured Requests: {len(self.captured_requests)}")

            if self.captured_requests:
                logger.info("\nAll captured API requests:")
                for req in self.captured_requests:
                    logger.info(f"  {req['url']}")

        except Exception as e:
            logger.error(f"Reconnaissance failed: {e}", exc_info=True)
            raise
        finally:
            if self.browser:
                await self.browser.close()
            if self.playwright:
                await self.playwright.stop()

async def main():
    """Main entry point"""
    recon = TexasBarReconnaissance()
    await recon.run()

if __name__ == "__main__":
    asyncio.run(main())
