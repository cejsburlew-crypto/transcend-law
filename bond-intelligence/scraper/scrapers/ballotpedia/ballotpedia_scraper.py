"""
Ballotpedia bond measure scraper.

Source: https://ballotpedia.org/

Correct URL format: /California_2024_local_ballot_measures (no 'wiki/' prefix)
Scrapes the index page per state/year for school/community-college bond links,
then scrapes each individual measure page for result, amount, and vote pct.
"""

from __future__ import annotations

import re
import time
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential

from config import (
    TARGET_STATES,
    REQUEST_DELAY,
    MAX_RETRIES,
    DATA_DIR,
)

RAW_DIR = Path(DATA_DIR) / "raw" / "ballotpedia"
RAW_DIR.mkdir(parents=True, exist_ok=True)

BALLOTPEDIA_BASE = "https://ballotpedia.org"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# State name → URL slug component
STATE_NAMES = {
    "CA": "California",
    "TX": "Texas",
    "FL": "Florida",
    "AZ": "Arizona",
    "OR": "Oregon",
    "WA": "Washington",
    "CO": "Colorado",
    "MI": "Michigan",
    "NY": "New_York",
    "GA": "Georgia",
    "NC": "North_Carolina",
    "NV": "Nevada",
    "IL": "Illinois",
    "OH": "Ohio",
}

# Keywords that identify school/community-college bonds we care about
SCHOOL_KEYWORDS = [
    "unified school district",
    "elementary school district",
    "high school district",
    "school district",
    "community college",
    "junior college",
    " usd ",
    " esd ",
    " hsd ",
]

# Keywords in measure TITLES that indicate a bond (not a parcel tax, charter, etc.)
BOND_TITLE_KEYWORDS = ["bond", "general obligation", "school improvement", "facility"]


def _make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": USER_AGENT})
    return s


@retry(stop=stop_after_attempt(MAX_RETRIES), wait=wait_exponential(min=2, max=10))
def _get(session: requests.Session, url: str) -> requests.Response:
    time.sleep(REQUEST_DELAY)
    resp = session.get(url, timeout=30, allow_redirects=True)
    resp.raise_for_status()
    return resp


def _is_school_bond_link(text: str) -> bool:
    """Return True if a link text refers to a school/CC bond measure."""
    tl = text.lower()
    has_school = any(kw in tl for kw in SCHOOL_KEYWORDS)
    has_bond   = any(kw in tl for kw in BOND_TITLE_KEYWORDS)
    return has_school and has_bond


def _infer_agency_type(name: str) -> str:
    n = name.lower()
    if any(k in n for k in ["community college", "junior college", " ccd", " coc"]):
        return "community_college"
    if any(k in n for k in ["unified school", "elementary school", "high school",
                             "school district", " usd", " esd", " hsd"]):
        return "k12_district"
    return "other"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def scrape_bond_measures(
    states: Optional[List[str]] = None,
    start_year: int = 2020,
    end_year: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """
    Scrape Ballotpedia bond measure results for the given states and years.
    Returns list of dicts with agency/bond measure data.
    """
    if states is None:
        states = TARGET_STATES
    if end_year is None:
        end_year = datetime.now().year

    session = _make_session()
    all_records: List[Dict[str, Any]] = []

    for state in states:
        state_name = STATE_NAMES.get(state)
        if not state_name:
            logger.warning(f"Ballotpedia: no mapping for state={state}")
            continue

        for year in range(start_year, end_year + 1):
            logger.info(f"Ballotpedia: scraping {state} bond measures for {year}")
            try:
                records = _scrape_state_year(session, state, state_name, year)
                all_records.extend(records)
            except Exception as exc:
                logger.error(f"Ballotpedia: failed {state}/{year}: {exc}")

    logger.info(f"Ballotpedia total: {len(all_records)} records")
    return all_records


def _scrape_state_year(
    session: requests.Session,
    state: str,
    state_name: str,
    year: int,
) -> List[Dict[str, Any]]:
    """
    Fetch the index page for a state/year and collect school bond measure links.
    Then scrape each individual measure page.
    """
    # Ballotpedia URL format: /California_2024_local_ballot_measures
    url_candidates = [
        f"{BALLOTPEDIA_BASE}/{state_name}_{year}_local_ballot_measures",
        f"{BALLOTPEDIA_BASE}/{state_name}_local_ballot_measures,_{year}",
        f"{BALLOTPEDIA_BASE}/{state_name}_{year}_ballot_measures",
    ]

    resp = None
    for url in url_candidates:
        try:
            resp = _get(session, url)
            if resp.status_code == 200 and len(resp.text) > 5000:
                break
        except requests.HTTPError:
            continue

    if not resp or len(resp.text) < 5000:
        logger.debug(f"Ballotpedia: no index page found for {state}/{year}")
        return []

    soup = BeautifulSoup(resp.text, "lxml")

    # Save raw HTML
    raw_path = RAW_DIR / f"ballotpedia_{state.lower()}_{year}_index.html"
    raw_path.write_text(resp.text, encoding="utf-8", errors="replace")

    # Collect all links to school bond measure pages
    measure_links = _collect_bond_links(soup, state)
    logger.info(f"Ballotpedia: {state}/{year} → {len(measure_links)} school bond links")

    records: List[Dict[str, Any]] = []
    for link_text, link_url in measure_links[:60]:  # cap to avoid hammering
        try:
            rec = _scrape_measure_page(session, link_url, state, year, link_text)
            if rec:
                records.append(rec)
        except Exception as exc:
            logger.debug(f"Ballotpedia: failed to scrape {link_url}: {exc}")

    return records


def _collect_bond_links(soup: BeautifulSoup, state: str) -> List[Tuple[str, str]]:
    """Return (text, absolute_url) for all school bond measure links on the index page."""
    links: List[Tuple[str, str]] = []
    seen: set = set()

    content = soup.find("div", class_="mw-parser-output") or soup.find("div", id="mw-content-text") or soup
    for a in content.find_all("a", href=True):
        href = a.get("href", "")
        text = a.get_text(strip=True)
        if not href or not text:
            continue
        # Absolute URL
        if href.startswith("/"):
            href = BALLOTPEDIA_BASE + href
        if not href.startswith("https://ballotpedia.org/"):
            continue
        if href in seen:
            continue
        if _is_school_bond_link(text):
            seen.add(href)
            links.append((text, href))

    return links


def _scrape_measure_page(
    session: requests.Session,
    url: str,
    state: str,
    year: int,
    link_text: str,
) -> Optional[Dict[str, Any]]:
    """Scrape an individual Ballotpedia bond measure page."""
    resp = _get(session, url)
    soup = BeautifulSoup(resp.text, "lxml")

    page_text = soup.get_text(" ", strip=True)

    # Extract result from infobox or page text
    result = _extract_result(soup, page_text)

    # Extract bond amount from page text
    bond_amount = _extract_bond_amount(page_text)

    # Extract vote percentage
    vote_pct = _extract_vote_pct(page_text)

    # Extract election date
    election_date = _extract_election_date(soup, page_text, year)

    # Extract agency name from link text or page title
    agency_name = _extract_agency_name(link_text, soup)

    if not agency_name:
        return None

    # Extract measure identifier
    measure_name = _extract_measure_name(link_text, soup)

    passed: Optional[bool] = None
    if result == "passed":
        passed = True
    elif result == "defeated":
        passed = False
    elif vote_pct is not None:
        passed = vote_pct >= 55.0

    return {
        "name":            agency_name,
        "state":           state,
        "agency_type":     _infer_agency_type(agency_name),
        "measure_name":    measure_name or link_text[:80],
        "election_date":   election_date.isoformat() if election_date else f"{year}-11-01",
        "bond_amount":     bond_amount,
        "result":          result or ("passed" if passed else "defeated" if passed is False else "unknown"),
        "passed":          passed,
        "vote_percentage": vote_pct,
        "source_url":      url,
    }


# ---------------------------------------------------------------------------
# Extraction helpers
# ---------------------------------------------------------------------------

def _extract_result(soup: BeautifulSoup, page_text: str) -> Optional[str]:
    """Extract passed/defeated from the infobox Status row or page text."""
    infobox = soup.find("table", class_="infobox")
    if infobox:
        for row in infobox.find_all("tr"):
            th = row.find("th")
            td = row.find("td")
            if th and td and "status" in th.get_text(strip=True).lower():
                status = td.get_text(strip=True).lower()
                if any(w in status for w in ["passed", "approved", "adopted"]):
                    return "passed"
                if any(w in status for w in ["defeated", "failed", "rejected"]):
                    return "defeated"

    # Fallback: look for "It was passed" / "It was defeated" in body text
    if re.search(r"\bIt was (passed|approved|adopted)\b", page_text, re.I):
        return "passed"
    if re.search(r"\bIt was (defeated|failed|rejected)\b", page_text, re.I):
        return "defeated"
    return None


def _extract_bond_amount(text: str) -> Optional[float]:
    """Extract bond amount like '$450,000,000' or '$450 million' from page text."""
    patterns = [
        r"\$([\d,]+(?:\.\d+)?)\s*billion",
        r"\$([\d,]+(?:\.\d+)?)\s*million",
        r"(?:authorize|issue|approved?)\s+\$([\d,]+(?:\.\d+)?)\s*(?:in\s+bonds)?",
        r"\$([\d,]+(?:\.\d+)?)\s+in\s+bonds",
        r"issuing\s+\$([\d,]+(?:\.\d+)?)",
    ]
    multipliers = {
        "billion": 1_000_000_000,
        "million": 1_000_000,
    }
    for pat in patterns:
        m = re.search(pat, text, re.I)
        if m:
            raw = m.group(1).replace(",", "")
            val = float(raw)
            # Check for multiplier word near match
            context = text[max(0, m.start()-5):m.end()+10].lower()
            for word, mult in multipliers.items():
                if word in context:
                    return val * mult
            if val < 10_000:  # likely millions
                return val * 1_000_000
            return val
    return None


def _extract_vote_pct(text: str) -> Optional[float]:
    """Extract yes-vote percentage."""
    patterns = [
        r"Yes\s+([\d.]+)%",
        r"([\d.]+)%\s+yes",
        r"received\s+([\d.]+)%",
        r"([\d.]+)%\s+in\s+favor",
    ]
    for pat in patterns:
        m = re.search(pat, text, re.I)
        if m:
            try:
                return float(m.group(1))
            except ValueError:
                pass
    return None


def _extract_election_date(soup: BeautifulSoup, page_text: str, year: int) -> Optional[date]:
    """Extract election date from infobox."""
    infobox = soup.find("table", class_="infobox")
    if infobox:
        for row in infobox.find_all("tr"):
            th = row.find("th")
            td = row.find("td")
            if th and td and "election" in th.get_text(strip=True).lower():
                date_str = td.get_text(strip=True)
                dt = _parse_date(date_str)
                if dt:
                    return dt

    # Look for date in text
    m = re.search(r"(November|March|May|June|August)\s+\d{1,2},\s+\d{4}", page_text)
    if m:
        return _parse_date(m.group(0))

    return date(year, 11, 1)


def _extract_agency_name(link_text: str, soup: BeautifulSoup) -> str:
    """Extract agency name from the link text or page h1."""
    # Link text format: "Livermore Valley Joint Unified School District, California, Measure G, School Improvements Bond Measure (November 2022)"
    # Extract agency name = everything before the first comma that's followed by a state name
    m = re.match(r"^([^,]+(?:School District|Community College|College District|Junior College|Unified)[^,]*)", link_text, re.I)
    if m:
        return m.group(1).strip()

    # Fallback to h1
    h1 = soup.find("h1")
    if h1:
        text = h1.get_text(strip=True)
        m2 = re.match(r"^([^,]+(?:School District|Community College|College District)[^,]*)", text, re.I)
        if m2:
            return m2.group(1).strip()

    return link_text.split(",")[0].strip()


def _extract_measure_name(link_text: str, soup: BeautifulSoup) -> Optional[str]:
    """Extract 'Measure G' or similar from link text."""
    m = re.search(r"Measure ([A-Z0-9]+)", link_text)
    if m:
        return f"Measure {m.group(1)}"
    m2 = re.search(r"Proposition ([A-Z0-9]+)", link_text)
    if m2:
        return f"Proposition {m2.group(1)}"
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
