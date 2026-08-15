#!/usr/bin/env python3
"""
Texas State Bar - Direct API Probe
Objective: Test common API endpoints and request patterns
"""

import asyncio
import aiohttp
import json
from typing import Dict, Any, Optional
from urllib.parse import urljoin, quote
import logging
from colorama import Fore, Style, init as colorama_init

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("API_PROBE")
colorama_init(autoreset=True)

class APIProbe:
    """Probe common API patterns"""

    BASE_URL = "https://www.texasbar.com"

    # Common API endpoint patterns
    COMMON_ENDPOINTS = [
        "/api/search/attorneys",
        "/api/attorney/search",
        "/api/attorneys",
        "/AM/api/attorneys",
        "/AM/Template.cfm?Section=SearchAPI",
        "/services/search.asmx",
        "/Ajax/Search.ashx",
        "/api/v1/attorneys/search",
        "/AM/TemplateRedirect.cfm?api=attorneys",
    ]

    # Common search patterns
    SEARCH_PATTERNS = [
        {"query": "Smith"},  # Common last name
        {"name": "Smith"},
        {"lastName": "Smith"},
        {"attorney_name": "Smith"},
        {"q": "Smith"},
        {},  # Empty query - might return first page
    ]

    async def test_endpoint(self, session: aiohttp.ClientSession, endpoint: str, params: Dict = None) -> Optional[Dict]:
        """Test a single endpoint"""
        url = urljoin(self.BASE_URL, endpoint)

        try:
            logger.info(f"Testing: {Fore.CYAN}{url}{Style.RESET_ALL}")

            # Try GET
            async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    content_type = resp.headers.get('content-type', '')

                    if 'json' in content_type:
                        data = await resp.json()
                        logger.info(f"  {Fore.GREEN}✓ JSON Response (200){Style.RESET_ALL}")
                        logger.debug(f"    Keys: {list(data.keys())[:10]}")
                        return {'url': url, 'method': 'GET', 'status': 200, 'type': 'json', 'sample': str(data)[:200]}
                    else:
                        text = await resp.text()
                        if len(text) > 100:
                            logger.info(f"  {Fore.YELLOW}Response: {text[:100]}...{Style.RESET_ALL}")
                            return {'url': url, 'method': 'GET', 'status': 200, 'type': 'html'}
                else:
                    logger.debug(f"  Status: {resp.status}")

        except asyncio.TimeoutError:
            logger.debug(f"  Timeout")
        except aiohttp.ClientError as e:
            logger.debug(f"  Connection error: {type(e).__name__}")
        except Exception as e:
            logger.debug(f"  Error: {e}")

        return None

    async def run(self):
        """Run API probe"""
        logger.info(f"{Fore.GREEN}=== Texas State Bar API Probe ==={Style.RESET_ALL}\n")

        async with aiohttp.ClientSession() as session:
            # Add headers to mimic browser
            session.headers.update({
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })

            logger.info(f"{Fore.YELLOW}Testing common endpoints...{Style.RESET_ALL}")
            results = []

            for endpoint in self.COMMON_ENDPOINTS:
                for pattern in self.SEARCH_PATTERNS[:1]:  # Test first pattern for now
                    result = await self.test_endpoint(session, endpoint, pattern)
                    if result:
                        results.append(result)
                    await asyncio.sleep(0.5)  # Rate limiting

            if results:
                logger.info(f"\n{Fore.GREEN}Found {len(results)} working endpoints:{Style.RESET_ALL}")
                for r in results:
                    logger.info(f"  {r['url']}")
            else:
                logger.info(f"\n{Fore.YELLOW}No standard API endpoints found.{Style.RESET_ALL}")
                logger.info("Will require DOM scraping via Playwright.")

async def main():
    probe = APIProbe()
    await probe.run()

if __name__ == "__main__":
    asyncio.run(main())
