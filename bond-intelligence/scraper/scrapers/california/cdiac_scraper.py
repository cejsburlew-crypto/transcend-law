"""
California CDIAC / DebtWatch scraper.

Data source: https://debtwatch.treasurer.ca.gov/
(California Debt and Investment Advisory Commission)

Scrapes:
  - K-14 bond election data
  - Authorized-but-unissued amounts by issuer
  - Recent bond issuances
"""

from __future__ import annotations

import time
import re
from datetime import date, datetime
from pathlib import Path
from typing import List, Dict, Optional, Any
from urllib.parse import urljoin, urlencode

import requests
from bs4 import BeautifulSoup
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential

from config import (
    CA_CDIAC_BASE_URL,
    CA_DEBTWATCH_BASE_URL,
    REQUEST_DELAY,
    MAX_RETRIES,
    USER_AGENT,
    DATA_DIR,
)

# ---------------------------------------------------------------------------
# DebtWatch API / page endpoints
# ---------------------------------------------------------------------------

DEBTWATCH_K14_URL = (
    "https://debtwatch.treasurer.ca.gov/BondExpenditures/K14BondExpenditures"
)
DEBTWATCH_ISSUANCES_URL = (
    "https://debtwatch.treasurer.ca.gov/Issuances/IssuanceSearch"
)
DEBTWATCH_AUTH_UNISSUED_URL = (
    "https://debtwatch.treasurer.ca.gov/AuthorizedUnissuedDebt/AuthUnissuedSearch"
)

# CA CDIAC also publishes data here (older but well-structured)
CDIAC_ELECTION_URL = (
    "https://www.treasurer.ca.gov/cdiac/elections.asp"
)

RAW_DIR = Path(DATA_DIR) / "raw" / "california"


# ---------------------------------------------------------------------------
# HTTP session
# ---------------------------------------------------------------------------

def _make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": USER_AGENT})
    return s


# ---------------------------------------------------------------------------
# Robots.txt compliance: CDIAC does not disallow scrapers; DebtWatch is public.
# We always use REQUEST_DELAY between calls.
# ---------------------------------------------------------------------------


@retry(stop=stop_after_attempt(MAX_RETRIES), wait=wait_exponential(min=2, max=10))
def _get(session: requests.Session, url: str, params: dict = None) -> requests.Response:
    time.sleep(REQUEST_DELAY)
    resp = session.get(url, params=params, timeout=30)
    resp.raise_for_status()
    return resp


# ---------------------------------------------------------------------------
# parse_agency_type_from_name
# ---------------------------------------------------------------------------

def parse_agency_type_from_name(name: str) -> str:
    """
    Infer agency_type enum value from the issuer name string.
    """
    n = name.lower()
    if any(t in n for t in ["unified school", "elementary school", "high school",
                             "school district", " usd", " esd", " hsd"]):
        return "k12_district"
    if any(t in n for t in ["community college", "college district", " ccd", " coc"]):
        return "community_college"
    if "city of" in n or n.startswith("city "):
        return "city"
    if "county of" in n or n.endswith(" county"):
        return "county"
    if any(t in n for t in ["transit", "transportation", "metro", "bart", "mta"]):
        return "transit"
    if any(t in n for t in ["water", "irrigation", "flood", "reclamation"]):
        return "water"
    if any(t in n for t in ["fire", "health", "hospital", "sanitary", "recreation",
                             "utility", "municipal", "harbor", "airport", "port"]):
        return "special_district"
    return "other"


# ---------------------------------------------------------------------------
# scrape_bond_elections
# ---------------------------------------------------------------------------

def scrape_bond_elections(
    years: Optional[List[int]] = None,
    agency_filter: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Fetch K-14 bond election data from CDIAC DebtWatch.

    Returns a list of dicts, each representing one bond measure election record.
    """
    if years is None:
        current_year = datetime.now().year
        years = list(range(2015, current_year + 1))

    session = _make_session()
    records: List[Dict[str, Any]] = []

    for year in years:
        logger.info(f"CDIAC: scraping K-14 bond elections for year={year}")
        try:
            records.extend(_scrape_k14_elections_year(session, year))
        except Exception as exc:
            logger.error(f"CDIAC: failed for year={year}: {exc}")

    logger.info(f"CDIAC bond elections: {len(records)} records collected")
    return records


def _scrape_k14_elections_year(
    session: requests.Session, year: int
) -> List[Dict[str, Any]]:
    """
    DebtWatch K-14 page uses a search form. We POST the year and parse the
    resulting HTML table.
    """
    url = DEBTWATCH_K14_URL
    # Initial GET to capture any CSRF tokens
    try:
        resp = _get(session, url)
    except Exception as exc:
        logger.warning(f"CDIAC K14 GET failed: {exc}; falling back to CDIAC election CSV")
        return _scrape_cdiac_elections_fallback(session, year)

    soup = BeautifulSoup(resp.text, "lxml")

    # Try to locate the election year dropdown / filter
    # DebtWatch uses Angular / Razor pages — look for data in script tags
    # or in a server-rendered table.
    records = _parse_k14_table(soup, source_url=url, year=year)

    if not records:
        # DebtWatch may paginate; try with explicit year parameter
        params = {
            "fiscalYear": year,
            "pageSize": 500,
            "pageNumber": 1,
        }
        try:
            resp2 = _get(session, url, params=params)
            soup2 = BeautifulSoup(resp2.text, "lxml")
            records = _parse_k14_table(soup2, source_url=resp2.url, year=year)
        except Exception as exc:
            logger.warning(f"CDIAC paginated request failed for year={year}: {exc}")

    # Save raw HTML
    raw_path = RAW_DIR / f"cdiac_k14_{year}_{date.today().isoformat()}.html"
    raw_path.write_text(resp.text, encoding="utf-8", errors="replace")

    return records


def _parse_k14_table(
    soup: BeautifulSoup, source_url: str, year: int
) -> List[Dict[str, Any]]:
    """
    Parse an HTML table from DebtWatch K-14 page.

    The table typically has columns:
      County | Agency | Measure | Election Date | Amount | Passed | Vote %
    """
    records: List[Dict[str, Any]] = []

    tables = soup.find_all("table")
    if not tables:
        logger.debug(f"CDIAC: no tables found in K14 response for year={year}")
        return records

    for table in tables:
        headers = [
            th.get_text(strip=True).lower()
            for th in table.find_all("th")
        ]
        if not headers:
            continue
        # Identify relevant columns by keyword matching
        col_map = _map_k14_columns(headers)
        if not col_map:
            continue

        for row in table.find_all("tr")[1:]:
            cells = row.find_all(["td", "th"])
            if len(cells) < 4:
                continue
            cell_text = [c.get_text(strip=True) for c in cells]
            rec = _extract_k14_row(cell_text, col_map, source_url, year)
            if rec:
                records.append(rec)

    return records


def _map_k14_columns(headers: List[str]) -> Dict[str, int]:
    """Return mapping of logical field → column index."""
    mapping: Dict[str, int] = {}
    for i, h in enumerate(headers):
        if "county" in h:
            mapping["county"] = i
        elif "agency" in h or "issuer" in h or "district" in h:
            mapping["agency"] = i
        elif "measure" in h or "letter" in h:
            mapping["measure"] = i
        elif "date" in h or "election" in h:
            mapping["election_date"] = i
        elif "amount" in h or "authorized" in h or "bond" in h:
            mapping["bond_amount"] = i
        elif "pass" in h or "result" in h or "status" in h:
            mapping["passed"] = i
        elif "%" in h or "percent" in h or "vote" in h:
            mapping["vote_pct"] = i
    return mapping if "agency" in mapping else {}


def _extract_k14_row(
    cells: List[str],
    col_map: Dict[str, int],
    source_url: str,
    year: int,
) -> Optional[Dict[str, Any]]:
    """Extract a single K-14 row into a structured dict."""
    def cell(key: str) -> str:
        idx = col_map.get(key)
        if idx is None or idx >= len(cells):
            return ""
        return cells[idx].strip()

    agency_name = cell("agency")
    if not agency_name:
        return None

    # Parse election date
    date_str = cell("election_date")
    election_date = _parse_date_flexible(date_str) or date(year, 11, 1)  # default to Nov

    # Parse bond amount
    amount_str = cell("bond_amount")
    bond_amount = _parse_dollar(amount_str)

    # Parse passed/failed
    passed_str = cell("passed").lower()
    if passed_str in ("yes", "passed", "approved", "true", "1"):
        passed = True
    elif passed_str in ("no", "failed", "rejected", "false", "0"):
        passed = False
    else:
        passed = None

    # Parse vote percentage
    vote_pct_str = cell("vote_pct")
    vote_pct = _parse_pct(vote_pct_str)

    return {
        "name":            agency_name,
        "state":           "CA",
        "county":          cell("county"),
        "agency_type":     parse_agency_type_from_name(agency_name),
        "measure_name":    cell("measure") or f"Measure {year}",
        "measure_letter":  cell("measure"),
        "election_date":   election_date.isoformat() if isinstance(election_date, date) else str(election_date),
        "bond_amount":     bond_amount,
        "passed":          passed,
        "vote_percentage": vote_pct,
        "source_url":      source_url,
    }


# ---------------------------------------------------------------------------
# scrape_authorized_unissued
# ---------------------------------------------------------------------------

def scrape_authorized_unissued() -> List[Dict[str, Any]]:
    """
    Fetch authorized-but-unissued debt amounts by issuer from DebtWatch.

    Returns list of dicts: {agency_name, state, authorized_amount, unissued_amount, source_url}
    """
    session = _make_session()
    records: List[Dict[str, Any]] = []
    url = DEBTWATCH_AUTH_UNISSUED_URL

    logger.info("CDIAC: scraping authorized/unissued amounts")
    try:
        resp = _get(session, url)
    except Exception as exc:
        logger.error(f"CDIAC authorized/unissued fetch failed: {exc}")
        return records

    soup = BeautifulSoup(resp.text, "lxml")

    # Save raw
    raw_path = RAW_DIR / f"cdiac_auth_unissued_{date.today().isoformat()}.html"
    raw_path.write_text(resp.text, encoding="utf-8", errors="replace")

    tables = soup.find_all("table")
    for table in tables:
        headers = [th.get_text(strip=True).lower() for th in table.find_all("th")]
        if not headers:
            continue

        # Find relevant columns
        issuer_idx      = _find_col(headers, ["issuer", "agency", "district"])
        auth_idx        = _find_col(headers, ["authorized", "auth amount"])
        unissued_idx    = _find_col(headers, ["unissued", "remaining"])

        if issuer_idx is None:
            continue

        for row in table.find_all("tr")[1:]:
            cells = [td.get_text(strip=True) for td in row.find_all(["td", "th"])]
            if len(cells) <= issuer_idx:
                continue

            issuer = cells[issuer_idx]
            if not issuer:
                continue

            auth_amount    = _parse_dollar(cells[auth_idx]) if auth_idx is not None and auth_idx < len(cells) else None
            unissued_amount = _parse_dollar(cells[unissued_idx]) if unissued_idx is not None and unissued_idx < len(cells) else None

            records.append({
                "name":             issuer,
                "state":            "CA",
                "agency_type":      parse_agency_type_from_name(issuer),
                "authorized_amount": auth_amount,
                "unissued_amount":  unissued_amount,
                "source_url":       resp.url,
            })

    # Handle pagination
    next_url = _find_next_page(soup, resp.url)
    while next_url:
        try:
            time.sleep(REQUEST_DELAY)
            resp = session.get(next_url, timeout=30)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "lxml")
            # parse same tables
            for table in soup.find_all("table"):
                headers = [th.get_text(strip=True).lower() for th in table.find_all("th")]
                issuer_idx   = _find_col(headers, ["issuer", "agency", "district"])
                auth_idx     = _find_col(headers, ["authorized"])
                unissued_idx = _find_col(headers, ["unissued", "remaining"])
                if issuer_idx is None:
                    continue
                for row in table.find_all("tr")[1:]:
                    cells = [td.get_text(strip=True) for td in row.find_all(["td", "th"])]
                    if len(cells) <= issuer_idx:
                        continue
                    issuer = cells[issuer_idx]
                    if not issuer:
                        continue
                    records.append({
                        "name":              issuer,
                        "state":             "CA",
                        "agency_type":       parse_agency_type_from_name(issuer),
                        "authorized_amount": _parse_dollar(cells[auth_idx]) if auth_idx and auth_idx < len(cells) else None,
                        "unissued_amount":   _parse_dollar(cells[unissued_idx]) if unissued_idx and unissued_idx < len(cells) else None,
                        "source_url":        resp.url,
                    })
            next_url = _find_next_page(soup, resp.url)
        except Exception as exc:
            logger.warning(f"CDIAC auth/unissued pagination error: {exc}")
            break

    logger.info(f"CDIAC authorized/unissued: {len(records)} records")
    return records


# ---------------------------------------------------------------------------
# scrape_debt_issuances
# ---------------------------------------------------------------------------

def scrape_debt_issuances(
    start_year: int = 2020,
    end_year: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """
    Fetch recent bond issuances from DebtWatch issuance search.
    """
    if end_year is None:
        end_year = datetime.now().year

    session = _make_session()
    records: List[Dict[str, Any]] = []

    for year in range(start_year, end_year + 1):
        logger.info(f"CDIAC: scraping debt issuances for year={year}")
        try:
            params = {
                "saleYear":  year,
                "pageSize":  500,
                "pageNumber": 1,
            }
            resp = _get(session, DEBTWATCH_ISSUANCES_URL, params=params)
            soup = BeautifulSoup(resp.text, "lxml")

            # Save raw
            raw_path = RAW_DIR / f"cdiac_issuances_{year}_{date.today().isoformat()}.html"
            raw_path.write_text(resp.text, encoding="utf-8", errors="replace")

            for table in soup.find_all("table"):
                headers = [th.get_text(strip=True).lower() for th in table.find_all("th")]
                issuer_idx  = _find_col(headers, ["issuer", "agency", "name"])
                amount_idx  = _find_col(headers, ["amount", "par amount", "principal"])
                date_idx    = _find_col(headers, ["sale date", "issue date", "dated date"])
                type_idx    = _find_col(headers, ["type", "debt type"])

                if issuer_idx is None:
                    continue

                for row in table.find_all("tr")[1:]:
                    cells = [td.get_text(strip=True) for td in row.find_all(["td", "th"])]
                    if len(cells) <= issuer_idx:
                        continue
                    issuer = cells[issuer_idx]
                    if not issuer:
                        continue

                    issue_date = None
                    if date_idx and date_idx < len(cells):
                        issue_date = _parse_date_flexible(cells[date_idx])

                    records.append({
                        "name":        issuer,
                        "state":       "CA",
                        "agency_type": parse_agency_type_from_name(issuer),
                        "bond_amount": _parse_dollar(cells[amount_idx]) if amount_idx and amount_idx < len(cells) else None,
                        "issue_date":  issue_date.isoformat() if issue_date else None,
                        "debt_type":   cells[type_idx] if type_idx and type_idx < len(cells) else None,
                        "source_url":  resp.url,
                    })
        except Exception as exc:
            logger.error(f"CDIAC issuances year={year} failed: {exc}")

    logger.info(f"CDIAC debt issuances: {len(records)} records")
    return records


# ---------------------------------------------------------------------------
# Fallback: CDIAC legacy election page
# ---------------------------------------------------------------------------

def _scrape_cdiac_elections_fallback(
    session: requests.Session, year: int
) -> List[Dict[str, Any]]:
    """
    Fallback to the older CDIAC elections page if DebtWatch is unavailable.
    """
    url = f"{CA_CDIAC_BASE_URL}elections.asp"
    records: List[Dict[str, Any]] = []
    try:
        resp = _get(session, url, params={"year": year})
        soup = BeautifulSoup(resp.text, "lxml")
        records = _parse_k14_table(soup, source_url=url, year=year)
        if not records:
            logger.warning(f"CDIAC fallback: no records parsed for year={year}")
    except Exception as exc:
        logger.error(f"CDIAC fallback failed for year={year}: {exc}")
    return records


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def _find_col(headers: List[str], keywords: List[str]) -> Optional[int]:
    for i, h in enumerate(headers):
        for kw in keywords:
            if kw in h:
                return i
    return None


def _find_next_page(soup: BeautifulSoup, current_url: str) -> Optional[str]:
    """Look for a 'Next' pagination link."""
    for link in soup.find_all("a"):
        txt = link.get_text(strip=True).lower()
        if txt in ("next", "next page", ">", "»"):
            href = link.get("href", "")
            if href:
                return urljoin(current_url, href)
    return None


def _parse_date_flexible(s: str) -> Optional[date]:
    if not s:
        return None
    from dateutil import parser as dp
    try:
        return dp.parse(s, fuzzy=True).date()
    except Exception:
        # Try common formats manually
        for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%B %d, %Y", "%b %d, %Y", "%m-%d-%Y"):
            try:
                return datetime.strptime(s.strip(), fmt).date()
            except ValueError:
                continue
    return None


def _parse_dollar(s: str) -> Optional[float]:
    if not s:
        return None
    s = s.strip().replace(",", "").replace("$", "").replace(" ", "")
    # Handle M / B suffixes
    multiplier = 1.0
    if s.lower().endswith("b"):
        multiplier = 1_000_000_000
        s = s[:-1]
    elif s.lower().endswith("m"):
        multiplier = 1_000_000
        s = s[:-1]
    elif s.lower().endswith("k"):
        multiplier = 1_000
        s = s[:-1]
    try:
        return float(s) * multiplier
    except ValueError:
        return None


def _parse_pct(s: str) -> Optional[float]:
    if not s:
        return None
    s = s.strip().replace("%", "").strip()
    try:
        return float(s)
    except ValueError:
        return None
