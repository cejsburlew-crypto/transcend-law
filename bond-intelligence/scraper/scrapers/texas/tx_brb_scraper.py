"""
Texas Bond Review Board scraper.

Source: https://www.brb.texas.gov/

Scrapes:
  - Local government bond issuances
  - Bond election results
  - Authorized-but-unissued debt
"""

from __future__ import annotations

import re
import time
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential

from config import TX_BRB_BASE_URL, REQUEST_DELAY, MAX_RETRIES, USER_AGENT, DATA_DIR

RAW_DIR = Path(DATA_DIR) / "raw" / "texas"

TX_BRB_ISSUANCES_URL = "https://www.brb.texas.gov/debt/localdebt/issuance.aspx"
TX_BRB_ELECTION_URL  = "https://www.brb.texas.gov/debt/localdebt/election.aspx"
TX_BRB_AUTH_URL      = "https://www.brb.texas.gov/debt/localdebt/authorizedunissued.aspx"

# Texas agency type keywords
TX_AGENCY_KEYWORDS = {
    "independent school district": "k12_district",
    " isd":                        "k12_district",
    "school district":             "k12_district",
    "community college":           "community_college",
    "junior college":              "community_college",
    "city of":                     "city",
    "county":                      "county",
    "municipal utility":           "water",
    "water district":              "water",
    "hospital district":           "special_district",
    "transit":                     "transit",
    "transportation":              "transit",
    "port":                        "special_district",
    "airport":                     "special_district",
}


def _make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": USER_AGENT})
    return s


@retry(stop=stop_after_attempt(MAX_RETRIES), wait=wait_exponential(min=2, max=10))
def _get(session: requests.Session, url: str, **kwargs) -> requests.Response:
    time.sleep(REQUEST_DELAY)
    resp = session.get(url, timeout=30, **kwargs)
    resp.raise_for_status()
    return resp


def parse_tx_agency_type(name: str) -> str:
    n = name.lower()
    for kw, atype in TX_AGENCY_KEYWORDS.items():
        if kw in n:
            return atype
    return "other"


# ---------------------------------------------------------------------------
# Bond election results
# ---------------------------------------------------------------------------

def scrape_bond_elections(
    start_year: int = 2018,
    end_year: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Scrape TX BRB bond election results."""
    if end_year is None:
        end_year = datetime.now().year

    session = _make_session()
    records: List[Dict[str, Any]] = []

    for year in range(start_year, end_year + 1):
        logger.info(f"TX BRB: scraping bond elections for year={year}")
        try:
            resp = _get(session, TX_BRB_ELECTION_URL, params={"year": year})
            soup = BeautifulSoup(resp.text, "lxml")

            raw_path = RAW_DIR / f"tx_brb_elections_{year}_{date.today().isoformat()}.html"
            raw_path.write_text(resp.text, encoding="utf-8", errors="replace")

            year_records = _parse_election_table(soup, resp.url, year)
            records.extend(year_records)
            logger.info(f"TX BRB: year={year} → {len(year_records)} records")
        except Exception as exc:
            logger.error(f"TX BRB elections year={year}: {exc}")

    logger.info(f"TX BRB bond elections total: {len(records)}")
    return records


def _parse_election_table(soup: BeautifulSoup, source_url: str, year: int) -> List[Dict[str, Any]]:
    records: List[Dict[str, Any]] = []
    for table in soup.find_all("table"):
        headers = [th.get_text(strip=True).lower() for th in table.find_all("th")]
        if not headers:
            continue
        col_map = _map_election_columns(headers)
        if "entity" not in col_map and "issuer" not in col_map:
            continue

        for row in table.find_all("tr")[1:]:
            cells = [td.get_text(strip=True) for td in row.find_all(["td", "th"])]
            if len(cells) < 3:
                continue
            rec = _extract_election_row(cells, col_map, source_url, year)
            if rec:
                records.append(rec)
    return records


def _map_election_columns(headers: List[str]) -> Dict[str, int]:
    col: Dict[str, int] = {}
    for i, h in enumerate(headers):
        if any(k in h for k in ["entity", "issuer", "district", "agency", "name"]):
            col.setdefault("entity", i)
        elif "county" in h:
            col["county"] = i
        elif "type" in h:
            col["agency_type"] = i
        elif "date" in h or "election" in h:
            col["election_date"] = i
        elif "amount" in h or "authorized" in h:
            col["bond_amount"] = i
        elif "result" in h or "pass" in h or "approve" in h:
            col["result"] = i
        elif "%" in h or "percent" in h or "vote" in h:
            col["vote_pct"] = i
        elif "purpose" in h or "proposition" in h:
            col["purpose"] = i
    return col


def _extract_election_row(
    cells: List[str], col_map: Dict[str, int], source_url: str, year: int
) -> Optional[Dict[str, Any]]:
    def cell(key: str) -> str:
        idx = col_map.get(key)
        return cells[idx].strip() if idx is not None and idx < len(cells) else ""

    entity = cell("entity")
    if not entity:
        return None

    amount_str = cell("bond_amount")
    amount = _parse_dollar(amount_str)

    result_str = cell("result").lower()
    passed: Optional[bool] = None
    if result_str in ("passed", "approved", "yes", "p"):
        passed = True
    elif result_str in ("failed", "rejected", "no", "f"):
        passed = False

    vote_pct = _parse_pct(cell("vote_pct"))
    if passed is None and vote_pct is not None:
        passed = vote_pct >= 55.0

    date_str = cell("election_date")
    election_date = _parse_date(date_str) or date(year, 11, 1)

    return {
        "name":            entity,
        "state":           "TX",
        "county":          cell("county"),
        "agency_type":     parse_tx_agency_type(entity),
        "measure_name":    cell("purpose") or f"Proposition {year}",
        "election_date":   election_date.isoformat() if isinstance(election_date, date) else str(election_date),
        "bond_amount":     amount,
        "passed":          passed,
        "vote_percentage": vote_pct,
        "source_url":      source_url,
    }


# ---------------------------------------------------------------------------
# Bond issuances (confirm money is being spent)
# ---------------------------------------------------------------------------

def scrape_issuances(
    start_year: int = 2018,
    end_year: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Scrape TX BRB local government bond issuances."""
    if end_year is None:
        end_year = datetime.now().year

    session = _make_session()
    records: List[Dict[str, Any]] = []

    for year in range(start_year, end_year + 1):
        logger.info(f"TX BRB: scraping issuances year={year}")
        try:
            resp = _get(session, TX_BRB_ISSUANCES_URL, params={"year": year})
            soup = BeautifulSoup(resp.text, "lxml")

            raw_path = RAW_DIR / f"tx_brb_issuances_{year}_{date.today().isoformat()}.html"
            raw_path.write_text(resp.text, encoding="utf-8", errors="replace")

            year_records = _parse_issuance_table(soup, resp.url, year)
            records.extend(year_records)
        except Exception as exc:
            logger.error(f"TX BRB issuances year={year}: {exc}")

    logger.info(f"TX BRB issuances total: {len(records)}")
    return records


def _parse_issuance_table(soup: BeautifulSoup, source_url: str, year: int) -> List[Dict[str, Any]]:
    records: List[Dict[str, Any]] = []
    for table in soup.find_all("table"):
        headers = [th.get_text(strip=True).lower() for th in table.find_all("th")]
        entity_idx  = _find_col(headers, ["entity", "issuer", "name", "district"])
        amount_idx  = _find_col(headers, ["amount", "par", "principal"])
        date_idx    = _find_col(headers, ["sale date", "issue date", "date"])
        county_idx  = _find_col(headers, ["county"])

        if entity_idx is None:
            continue

        for row in table.find_all("tr")[1:]:
            cells = [td.get_text(strip=True) for td in row.find_all(["td", "th"])]
            if len(cells) <= entity_idx:
                continue
            entity = cells[entity_idx]
            if not entity:
                continue

            issue_date = None
            if date_idx and date_idx < len(cells):
                issue_date = _parse_date(cells[date_idx])

            records.append({
                "name":        entity,
                "state":       "TX",
                "agency_type": parse_tx_agency_type(entity),
                "county":      cells[county_idx] if county_idx and county_idx < len(cells) else None,
                "bond_amount": _parse_dollar(cells[amount_idx]) if amount_idx and amount_idx < len(cells) else None,
                "issue_date":  issue_date.isoformat() if issue_date else None,
                "source_url":  source_url,
            })
    return records


# ---------------------------------------------------------------------------
# Authorized/Unissued
# ---------------------------------------------------------------------------

def scrape_authorized_unissued() -> List[Dict[str, Any]]:
    """Scrape TX BRB authorized-but-unissued amounts."""
    session = _make_session()
    records: List[Dict[str, Any]] = []

    logger.info("TX BRB: scraping authorized/unissued amounts")
    try:
        resp = _get(session, TX_BRB_AUTH_URL)
        soup = BeautifulSoup(resp.text, "lxml")

        raw_path = RAW_DIR / f"tx_brb_auth_unissued_{date.today().isoformat()}.html"
        raw_path.write_text(resp.text, encoding="utf-8", errors="replace")

        for table in soup.find_all("table"):
            headers = [th.get_text(strip=True).lower() for th in table.find_all("th")]
            entity_idx   = _find_col(headers, ["entity", "issuer", "name"])
            auth_idx     = _find_col(headers, ["authorized"])
            unissued_idx = _find_col(headers, ["unissued", "remaining"])

            if entity_idx is None:
                continue

            for row in table.find_all("tr")[1:]:
                cells = [td.get_text(strip=True) for td in row.find_all(["td", "th"])]
                if len(cells) <= entity_idx:
                    continue
                entity = cells[entity_idx]
                if not entity:
                    continue
                records.append({
                    "name":             entity,
                    "state":            "TX",
                    "agency_type":      parse_tx_agency_type(entity),
                    "authorized_amount": _parse_dollar(cells[auth_idx]) if auth_idx and auth_idx < len(cells) else None,
                    "unissued_amount":  _parse_dollar(cells[unissued_idx]) if unissued_idx and unissued_idx < len(cells) else None,
                    "source_url":       resp.url,
                })
    except Exception as exc:
        logger.error(f"TX BRB auth/unissued: {exc}")

    logger.info(f"TX BRB auth/unissued: {len(records)} records")
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


def _parse_date(s: str) -> Optional[date]:
    if not s:
        return None
    from dateutil import parser as dp
    try:
        return dp.parse(s, fuzzy=True).date()
    except Exception:
        for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%B %d, %Y", "%b %d, %Y"):
            try:
                return datetime.strptime(s.strip(), fmt).date()
            except ValueError:
                continue
    return None


def _parse_dollar(s: str) -> Optional[float]:
    if not s:
        return None
    s = s.strip().replace(",", "").replace("$", "").replace(" ", "")
    multiplier = 1.0
    if s.lower().endswith("b"):
        multiplier = 1_000_000_000; s = s[:-1]
    elif s.lower().endswith("m"):
        multiplier = 1_000_000; s = s[:-1]
    elif s.lower().endswith("k"):
        multiplier = 1_000; s = s[:-1]
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
