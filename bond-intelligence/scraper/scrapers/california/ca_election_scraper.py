"""
California Secretary of State — local bond measure election results scraper.

Source: https://www.sos.ca.gov/elections/prior-elections/

Covers 2020-present local bond measure results (K-14, cities, special districts).
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

from config import (
    CA_SOS_BASE_URL,
    REQUEST_DELAY,
    MAX_RETRIES,
    USER_AGENT,
    DATA_DIR,
)

# ---------------------------------------------------------------------------
# Key SOS pages
# ---------------------------------------------------------------------------

SOS_PRIOR_ELECTIONS_URL = "https://www.sos.ca.gov/elections/prior-elections/"
SOS_STATEWIDE_RESULTS_BASE = "https://electionresults.sos.ca.gov/"

RAW_DIR = Path(DATA_DIR) / "raw" / "california"

# Known election cycles with local bond measures (most recent first)
KNOWN_ELECTION_CYCLES = [
    # (date, label, results_url)
    ("2024-11-05", "November 2024 General", "https://electionresults.sos.ca.gov/returns/local-measures"),
    ("2024-03-05", "March 2024 Primary",   "https://electionresults.sos.ca.gov/returns/local-measures"),
    ("2023-11-07", "November 2023 General", "https://www.sos.ca.gov/elections/prior-elections/statewide-election-results/november-7-2023-general"),
    ("2022-11-08", "November 2022 General", "https://www.sos.ca.gov/elections/prior-elections/statewide-election-results/november-8-2022-general"),
    ("2022-06-07", "June 2022 Primary",    "https://www.sos.ca.gov/elections/prior-elections/statewide-election-results/june-7-2022-primary"),
    ("2021-11-02", "November 2021 General", "https://www.sos.ca.gov/elections/prior-elections/statewide-election-results/november-2-2021-general"),
    ("2020-11-03", "November 2020 General", "https://www.sos.ca.gov/elections/prior-elections/statewide-election-results/november-3-2020-general"),
    ("2020-03-03", "March 2020 Primary",   "https://www.sos.ca.gov/elections/prior-elections/statewide-election-results/march-3-2020-primary"),
]


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


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def scrape_local_bond_measures(
    start_year: int = 2020,
    end_year: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """
    Scrape local bond measure results from the CA Secretary of State website
    for all election cycles between start_year and end_year (inclusive).

    Returns list of dicts suitable for BondMeasure model insertion.
    """
    if end_year is None:
        end_year = datetime.now().year

    session = _make_session()
    all_records: List[Dict[str, Any]] = []

    # First try the live election results portal
    live_records = _scrape_live_results_portal(session)
    all_records.extend(live_records)

    # Then scrape known prior election pages
    for cycle_date, cycle_label, cycle_url in KNOWN_ELECTION_CYCLES:
        cycle_year = int(cycle_date[:4])
        if not (start_year <= cycle_year <= end_year):
            continue
        logger.info(f"CA SOS: scraping {cycle_label} ({cycle_url})")
        try:
            records = _scrape_election_cycle(session, cycle_date, cycle_label, cycle_url)
            all_records.extend(records)
        except Exception as exc:
            logger.error(f"CA SOS: failed for {cycle_label}: {exc}")

    logger.info(f"CA SOS: total {len(all_records)} local bond measure records")
    return all_records


def _scrape_live_results_portal(session: requests.Session) -> List[Dict[str, Any]]:
    """
    Attempt to scrape the live election results portal at electionresults.sos.ca.gov.
    This site uses JavaScript heavily; we do a best-effort HTML parse.
    """
    url = "https://electionresults.sos.ca.gov/returns/local-measures"
    records: List[Dict[str, Any]] = []
    try:
        resp = _get(session, url)
        soup = BeautifulSoup(resp.text, "lxml")
        records = _parse_sos_results_page(soup, resp.url, election_date_str="")
        logger.info(f"CA SOS live portal: {len(records)} records")
    except Exception as exc:
        logger.warning(f"CA SOS live portal unavailable: {exc}")
    return records


def _scrape_election_cycle(
    session: requests.Session,
    cycle_date: str,
    cycle_label: str,
    cycle_url: str,
) -> List[Dict[str, Any]]:
    """Fetch and parse a single election cycle results page."""
    resp = _get(session, cycle_url)
    soup = BeautifulSoup(resp.text, "lxml")

    # Save raw
    safe_label = re.sub(r"[^\w]+", "_", cycle_label.lower())
    raw_path = RAW_DIR / f"sos_election_{safe_label}.html"
    raw_path.write_text(resp.text, encoding="utf-8", errors="replace")

    # Try to find the "local measures" section or link
    records: List[Dict[str, Any]] = []

    # Look for a link to local measures subpage
    local_measure_links = _find_local_measure_links(soup, resp.url)
    if local_measure_links:
        for link_url in local_measure_links[:5]:  # limit sub-page traversal
            try:
                sub_resp = _get(session, link_url)
                sub_soup = BeautifulSoup(sub_resp.text, "lxml")
                sub_records = _parse_sos_results_page(sub_soup, link_url, cycle_date)
                records.extend(sub_records)
            except Exception as exc:
                logger.warning(f"CA SOS sub-page {link_url}: {exc}")
    else:
        # Parse directly
        records = _parse_sos_results_page(soup, resp.url, cycle_date)

    return records


def _find_local_measure_links(soup: BeautifulSoup, base_url: str) -> List[str]:
    """Find links to local measure results sub-pages."""
    links = []
    for a in soup.find_all("a", href=True):
        text = a.get_text(strip=True).lower()
        href = a["href"]
        if any(kw in text for kw in ["local measure", "bond measure", "local bond", "school bond"]):
            full_url = urljoin(base_url, href)
            if full_url not in links:
                links.append(full_url)
    return links


def _parse_sos_results_page(
    soup: BeautifulSoup,
    source_url: str,
    election_date_str: str,
) -> List[Dict[str, Any]]:
    """
    Parse an SOS election results page for bond measure data.

    The SOS uses varied layouts across election cycles; this parser handles
    the most common table structures.
    """
    records: List[Dict[str, Any]] = []

    tables = soup.find_all("table")
    for table in tables:
        headers = [th.get_text(strip=True).lower() for th in table.find_all("th")]
        if not _is_bond_table(headers):
            continue

        col_map = _map_sos_columns(headers)
        if not col_map:
            continue

        for row in table.find_all("tr")[1:]:
            cells = [td.get_text(strip=True) for td in row.find_all(["td", "th"])]
            if len(cells) < 3:
                continue
            rec = _extract_sos_row(cells, col_map, source_url, election_date_str)
            if rec:
                records.append(rec)

    # Also look for definition-list style results common on newer SOS pages
    records.extend(_parse_sos_dl_results(soup, source_url, election_date_str))

    return records


def _is_bond_table(headers: List[str]) -> bool:
    """Check if the table headers look like a bond measure results table."""
    joined = " ".join(headers)
    return any(kw in joined for kw in ["measure", "bond", "agency", "district", "vote", "result"])


def _map_sos_columns(headers: List[str]) -> Dict[str, int]:
    col_map: Dict[str, int] = {}
    for i, h in enumerate(headers):
        if "county" in h:
            col_map["county"] = i
        elif "agency" in h or "district" in h or "jurisdiction" in h:
            col_map["agency"] = i
        elif "measure" in h or "letter" in h or "title" in h:
            col_map["measure"] = i
        elif "yes" in h and "%" not in h:
            col_map["votes_yes"] = i
        elif "no" in h and "%" not in h:
            col_map["votes_no"] = i
        elif "yes" in h and "%" in h:
            col_map["pct_yes"] = i
        elif "%" in h or "percent" in h:
            col_map["vote_pct"] = i
        elif "result" in h or "pass" in h or "status" in h:
            col_map["result"] = i
        elif "amount" in h or "bond" in h:
            col_map["bond_amount"] = i
    return col_map if "agency" in col_map or "measure" in col_map else {}


def _extract_sos_row(
    cells: List[str],
    col_map: Dict[str, int],
    source_url: str,
    election_date_str: str,
) -> Optional[Dict[str, Any]]:
    def cell(key: str) -> str:
        idx = col_map.get(key)
        return cells[idx].strip() if idx is not None and idx < len(cells) else ""

    agency  = cell("agency")
    measure = cell("measure")
    if not agency and not measure:
        return None

    # Compute passed from result or vote pct
    result_str = cell("result").lower()
    passed: Optional[bool] = None
    if result_str in ("yes", "passed", "approved"):
        passed = True
    elif result_str in ("no", "failed", "rejected"):
        passed = False

    # Parse vote percentages
    pct_yes = _parse_pct_str(cell("pct_yes") or cell("vote_pct"))
    votes_yes = _parse_int(cell("votes_yes"))
    votes_no  = _parse_int(cell("votes_no"))

    # Infer passed from percentages if not explicit
    if passed is None and pct_yes is not None:
        # CA K-12/CC bond threshold is 55%; general obligation is 66.67%
        # Default to 55% threshold check
        passed = pct_yes >= 55.0

    return {
        "name":            agency or "Unknown Agency",
        "state":           "CA",
        "county":          cell("county"),
        "agency_type":     _infer_agency_type(agency),
        "measure_name":    measure,
        "measure_letter":  measure if len(measure) <= 3 else "",
        "election_date":   election_date_str,
        "bond_amount":     _parse_dollar_str(cell("bond_amount")),
        "passed":          passed,
        "vote_percentage": pct_yes,
        "votes_yes":       votes_yes,
        "votes_no":        votes_no,
        "source_url":      source_url,
    }


def _parse_sos_dl_results(
    soup: BeautifulSoup, source_url: str, election_date_str: str
) -> List[Dict[str, Any]]:
    """
    Some SOS pages list results in <div class="measure-result"> blocks
    rather than tables. Parse those here.
    """
    records: List[Dict[str, Any]] = []
    for block in soup.find_all(["div", "section"], class_=re.compile(r"measure|bond|result", re.I)):
        text = block.get_text(" ", strip=True)
        # Look for patterns like: "Agency: Anytown USD  Measure A  55.32% YES"
        agency_match = re.search(r"(?:agency|district|jurisdiction)[:\s]+([^\n|]+)", text, re.I)
        pct_match    = re.search(r"([\d.]+)\s*%\s*(yes|no|for|against)", text, re.I)
        amount_match = re.search(r"\$[\d,\.]+\s*(?:million|billion|M|B)?", text, re.I)

        if not agency_match:
            continue

        agency = agency_match.group(1).strip()
        pct_yes = None
        passed  = None
        if pct_match:
            pct_yes = float(pct_match.group(1))
            vote_dir = pct_match.group(2).lower()
            if vote_dir in ("yes", "for"):
                passed = pct_yes >= 55.0
            else:
                passed = (100 - pct_yes) >= 55.0

        bond_amount = None
        if amount_match:
            bond_amount = _parse_dollar_str(amount_match.group(0))

        records.append({
            "name":            agency,
            "state":           "CA",
            "agency_type":     _infer_agency_type(agency),
            "election_date":   election_date_str,
            "vote_percentage": pct_yes,
            "passed":          passed,
            "bond_amount":     bond_amount,
            "source_url":      source_url,
        })

    return records


# ---------------------------------------------------------------------------
# parse_measure_result (public helper)
# ---------------------------------------------------------------------------

def parse_measure_result(html_snippet: str) -> Dict[str, Any]:
    """
    Extract passed/failed status and vote percentage from an HTML snippet
    containing a single bond measure result block.
    """
    soup = BeautifulSoup(html_snippet, "lxml")
    text = soup.get_text(" ", strip=True)

    # Vote percentage
    pct_match = re.search(r"([\d.]+)\s*%\s*(yes|no|for|against|approve|reject)", text, re.I)
    pct_yes = None
    passed  = None
    if pct_match:
        pct_yes = float(pct_match.group(1))
        direction = pct_match.group(2).lower()
        if direction in ("yes", "for", "approve"):
            passed = pct_yes >= 55.0
        else:
            passed = (100.0 - pct_yes) >= 55.0

    # Explicit pass/fail keywords
    if passed is None:
        if re.search(r"\b(passed|approved|yes)\b", text, re.I):
            passed = True
        elif re.search(r"\b(failed|rejected|defeated)\b", text, re.I):
            passed = False

    return {
        "passed":          passed,
        "vote_percentage": pct_yes,
    }


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def _infer_agency_type(name: str) -> str:
    from scrapers.california.cdiac_scraper import parse_agency_type_from_name
    return parse_agency_type_from_name(name)


def _parse_pct_str(s: str) -> Optional[float]:
    if not s:
        return None
    s = s.strip().replace("%", "")
    try:
        return float(s)
    except ValueError:
        return None


def _parse_dollar_str(s: str) -> Optional[float]:
    if not s:
        return None
    s = s.strip().replace(",", "").replace("$", "").replace(" ", "")
    multiplier = 1.0
    if s.lower().endswith("b"):
        multiplier = 1_000_000_000; s = s[:-1]
    elif s.lower().endswith("m"):
        multiplier = 1_000_000; s = s[:-1]
    try:
        return float(s) * multiplier
    except ValueError:
        return None


def _parse_int(s: str) -> Optional[int]:
    if not s:
        return None
    s = s.replace(",", "").strip()
    try:
        return int(s)
    except ValueError:
        return None
