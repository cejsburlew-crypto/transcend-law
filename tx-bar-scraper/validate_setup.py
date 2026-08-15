#!/usr/bin/env python3
"""
Setup validation script for Texas State Bar Scraper
Verifies all dependencies and configurations before production run
"""

import sys
import subprocess
from pathlib import Path
from typing import Tuple, List

# Color codes
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"

def print_section(title: str):
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}{title:^60}{RESET}")
    print(f"{BLUE}{'='*60}{RESET}")

def check_python() -> Tuple[bool, str]:
    """Check Python version"""
    version_info = sys.version_info
    version_string = f"{version_info.major}.{version_info.minor}.{version_info.micro}"

    if version_info >= (3, 8):
        return True, version_string
    return False, version_string

def check_package(package_name: str, import_name: str = None) -> Tuple[bool, str]:
    """Check if a package is installed"""
    if import_name is None:
        import_name = package_name.replace("-", "_")

    try:
        module = __import__(import_name)
        version = getattr(module, "__version__", "unknown")
        return True, version
    except ImportError:
        return False, "not installed"

def check_playwright_browsers() -> Tuple[bool, str]:
    """Check if Playwright chromium is installed"""
    try:
        from playwright.async_api import async_playwright
        import asyncio

        async def check():
            async with async_playwright() as p:
                if hasattr(p, 'chromium'):
                    return True
            return False

        result = asyncio.run(check())
        return result, "installed"
    except Exception as e:
        return False, str(e)

def check_directories() -> Tuple[bool, List[str]]:
    """Check if required directories can be created"""
    dirs = [
        Path("scratchpad/checkpoints"),
        Path("scratchpad/output"),
        Path("scratchpad/logs"),
    ]

    missing = []
    for d in dirs:
        try:
            d.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            missing.append(f"{d} ({e})")

    return len(missing) == 0, missing if missing else dirs

def check_urls() -> Tuple[bool, List[str]]:
    """Check if target URLs are reachable"""
    import urllib.request
    import urllib.error

    urls = [
        "https://www.texasbar.com/robots.txt",
        "https://www.texasbar.com/AM/Template.cfm?Section=Search",
    ]

    unreachable = []
    for url in urls:
        try:
            response = urllib.request.urlopen(url, timeout=5)
            if response.status != 200:
                unreachable.append(f"{url} (status: {response.status})")
        except Exception as e:
            unreachable.append(f"{url} ({type(e).__name__})")

    return len(unreachable) == 0, unreachable if unreachable else urls

def check_disk_space() -> Tuple[bool, str]:
    """Check available disk space"""
    import shutil
    total, used, free = shutil.disk_usage("/")
    free_gb = free / (1024**3)

    # Need at least 1GB for 380k records
    if free_gb >= 1.0:
        return True, f"{free_gb:.1f} GB available"
    return False, f"{free_gb:.1f} GB available (need 1+ GB)"

def main():
    print_section("Texas State Bar Scraper - Setup Validation")

    checks = [
        ("Python Version", check_python()),
        ("Playwright", check_package("playwright")),
        ("aiohttp", check_package("aiohttp")),
        ("pandas", check_package("pandas")),
        ("pydantic", check_package("pydantic")),
        ("Playwright Chromium", check_playwright_browsers()),
        ("Output Directories", check_directories()),
        ("Target URLs", check_urls()),
        ("Disk Space", check_disk_space()),
    ]

    results = []
    for name, (success, details) in checks:
        status = f"{GREEN}✓{RESET}" if success else f"{RED}✗{RESET}"

        if isinstance(details, (list, tuple)):
            details_str = f"{len(details)} items" if isinstance(details, list) else str(details)
        else:
            details_str = str(details)

        print(f"{status} {name:30} {details_str}")
        results.append(success)

    # Summary
    print_section("Validation Summary")

    passed = sum(results)
    total = len(results)

    if passed == total:
        print(f"{GREEN}All checks passed! ✓{RESET}")
        print(f"\nYou can now run the scraper:")
        print(f"  python 03_production_scraper.py --max-pages 2  (test)")
        print(f"  python 03_production_scraper.py                (full)")
        return 0
    else:
        print(f"{RED}Some checks failed: {total - passed}/{total}{RESET}")
        print(f"\nPlease install missing dependencies:")
        print(f"  pip install -r requirements.txt")
        print(f"  python -m playwright install chromium")
        return 1

if __name__ == "__main__":
    sys.exit(main())
