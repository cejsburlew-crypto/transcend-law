"""
Procurement portal scraper.

Targets public agency procurement portals for RFQs, RFPs, and RFEIs
related to program management, construction management, and inspection services.

Portals covered:
  - PlanetBids (widely used by CA school districts and cities)
  - BidNet Direct (multi-state)
  - CaleProcure (CA state agencies)
  - ESBD (TX electronic state business daily)
"""

from __future__ import annotations

import re
import time
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin, quote_plus

import requests
from bs4 import BeautifulSoup
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential

from config import (
    PROCUREMENT_KEYWORDS,
    TARGET_STATES,
    REQUEST_DELAY,
    MAX_RETRIES,
    USER_AGENT,
    DATA_DIR,
)

RAW_DIR = Path(DATA_DIR) / "raw" / "procurement"

# Search keyword groups — each is OR'd together
KEYWORD_GROUPS = [
    ["program management", "program manager", "program mgmt"],
    ["construction management", "construction manager", "CM at-risk", "CMAR"],
    ["inspector of record", "IOR", "DSA inspection"],
    ["materials testing", "geotechnical", "special inspection"],
    ["PMIS", "project management information"],
    ["owner representative", "owner's representative"],
    ["facilities master plan"],
    ["bond program oversight"],
]

# Flattened for search queries
ALL_KEYWORDS = [kw for group in KEYWORD_GROUPS for kw in group]

SERVICE_TYPE_MAP = {
    "program management":    "program_manager",
    "program manager":       "program_manager",
    "program mgmt":          "program_manager",
    "construction management": "construction_manager",
    "construction manager":  "construction_manager",
    "cmar":                  "construction_manager",
    "inspector of record":   "inspector",
    "ior":                   "inspector",
    "dsa inspection":        "inspector",
    "materials testing":     "testing",
    "geotechnical":          "testing",
    "special inspection":    "inspector",
    "pmis":                  "pmis",
    "owner representative":  "owner_rep",
    "owner's representative": "owner_rep",
    "facilities master plan": "master_plan",
    "bond program":          "program_manager",
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


def infer_service_type(title: str, description: str = "") -> str:
    """Map procurement title/description to a service type."""
    text = (title + " " + description).lower()
    for kw, stype in SERVICE_TYPE_MAP.items():
        if kw in text:
            return stype
    return "other"


def infer_event_type(title: str) -> str:
    """Map procurement title to event type."""
    t = title.lower()
    if any(w in t for w in ["rfq", "request for qualifications"]):
        return "rfq_issued"
    if any(w in t for w in ["rfp", "request for proposal"]):
        return "rfp_issued"
    if any(w in t for w in ["rfei", "request for expressions", "expressions of interest"]):
        return "rfei"
    if any(w in t for w in ["bid", "invitation for bid", "ifb"]):
        return "bid"
    if any(w in t for w in ["rfi", "request for information"]):
        return "rfi"
    return "rfq_issued"


# ---------------------------------------------------------------------------
# PlanetBids
# ---------------------------------------------------------------------------

PLANETBIDS_SEARCH_URL = "https://www.planetbids.com/portal/portal.cfm"

def scrape_planetbids(states: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    """
    Search PlanetBids for active solicitations matching our procurement keywords.
    PlanetBids hosts portals for many CA/TX public agencies.
    """
    session = _make_session()
    records: List[Dict[str, Any]] = []

    for keyword in PROCUREMENT_KEYWORDS[:5]:  # limit to top keywords to stay polite
        logger.info(f"PlanetBids: searching for '{keyword}'")
        try:
            params = {
                "do":      "pub_main",
                "keyword": keyword,
                "status":  "open",
            }
            resp = _get(session, PLANETBIDS_SEARCH_URL, params=params)
            soup = BeautifulSoup(resp.text, "lxml")

            raw_path = RAW_DIR / f"planetbids_{re.sub(r'[^\w]', '_', keyword)}.html"
            raw_path.write_text(resp.text, encoding="utf-8", errors="replace")

            keyword_records = _parse_planetbids_results(soup, resp.url, keyword)
            records.extend(keyword_records)
        except Exception as exc:
            logger.warning(f"PlanetBids keyword='{keyword}': {exc}")

    logger.info(f"PlanetBids: {len(records)} procurement records")
    return records


def _parse_planetbids_results(soup: BeautifulSoup, source_url: str, keyword: str) -> List[Dict[str, Any]]:
    records: List[Dict[str, Any]] = []
    for table in soup.find_all("table"):
        headers = [th.get_text(strip=True).lower() for th in table.find_all("th")]
        title_idx  = _find_col(headers, ["title", "solicitation", "description", "rfq", "rfp"])
        agency_idx = _find_col(headers, ["agency", "entity", "buyer", "owner", "client"])
        due_idx    = _find_col(headers, ["due", "deadline", "close"])
        issue_idx  = _find_col(headers, ["issue", "posted", "published", "open"])
        status_idx = _find_col(headers, ["status"])

        if title_idx is None:
            continue

        for row in table.find_all("tr")[1:]:
            cells = [td.get_text(" ", strip=True) for td in row.find_all(["td", "th"])]
            if len(cells) <= title_idx:
                continue

            title = cells[title_idx].strip()
            if not title:
                continue

            agency = cells[agency_idx].strip() if agency_idx and agency_idx < len(cells) else ""
            due_date_str = cells[due_idx].strip() if due_idx and due_idx < len(cells) else ""
            issue_date_str = cells[issue_idx].strip() if issue_idx and issue_idx < len(cells) else ""
            status = cells[status_idx].strip() if status_idx and status_idx < len(cells) else "active"

            records.append({
                "agency_name":  agency,
                "title":        title,
                "event_type":   infer_event_type(title),
                "service_type": infer_service_type(title),
                "issue_date":   _parse_date(issue_date_str),
                "due_date":     _parse_date(due_date_str),
                "status":       _normalize_status(status),
                "portal_name":  "PlanetBids",
                "source_url":   source_url,
                "state":        None,  # enriched later by loader
            })
    return records


# ---------------------------------------------------------------------------
# BidNet Direct
# ---------------------------------------------------------------------------

BIDNET_SEARCH_URL = "https://www.bidnetdirect.com/public/solicitations/keyword"

def scrape_bidnet(states: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    """Search BidNet Direct for relevant solicitations."""
    session = _make_session()
    records: List[Dict[str, Any]] = []

    for keyword in PROCUREMENT_KEYWORDS[:5]:
        logger.info(f"BidNet: searching for '{keyword}'")
        try:
            params = {"keyword": keyword, "status": "open"}
            resp = _get(session, BIDNET_SEARCH_URL, params=params)
            soup = BeautifulSoup(resp.text, "lxml")

            raw_path = RAW_DIR / f"bidnet_{re.sub(r'[^\w]', '_', keyword)}.html"
            raw_path.write_text(resp.text, encoding="utf-8", errors="replace")

            keyword_records = _parse_generic_table(soup, resp.url, "BidNet Direct")
            records.extend(keyword_records)
        except Exception as exc:
            logger.warning(f"BidNet keyword='{keyword}': {exc}")

    logger.info(f"BidNet: {len(records)} records")
    return records


# ---------------------------------------------------------------------------
# Generic table parser (reusable)
# ---------------------------------------------------------------------------

def _parse_generic_table(soup: BeautifulSoup, source_url: str, portal_name: str) -> List[Dict[str, Any]]:
    """
    Parse a generic solicitation results table.
    Works across PlanetBids, BidNet, and similar portal layouts.
    """
    records: List[Dict[str, Any]] = []
    for table in soup.find_all("table"):
        headers = [th.get_text(strip=True).lower() for th in table.find_all("th")]
        title_idx  = _find_col(headers, ["title", "solicitation", "bid title", "description"])
        agency_idx = _find_col(headers, ["agency", "entity", "buyer", "department", "owner"])
        due_idx    = _find_col(headers, ["due", "deadline", "closes", "close date"])
        issue_idx  = _find_col(headers, ["issued", "posted", "open", "publish"])
        state_idx  = _find_col(headers, ["state"])
        status_idx = _find_col(headers, ["status"])
        value_idx  = _find_col(headers, ["value", "estimate", "amount"])

        if title_idx is None:
            continue

        for row in table.find_all("tr")[1:]:
            cells = [td.get_text(" ", strip=True) for td in row.find_all(["td", "th"])]
            if not cells or len(cells) <= title_idx:
                continue

            title = cells[title_idx].strip()
            if not title or not _is_relevant_solicitation(title):
                continue

            agency = cells[agency_idx].strip() if agency_idx and agency_idx < len(cells) else ""
            state  = cells[state_idx].strip()[:2].upper() if state_idx and state_idx < len(cells) else None
            if state and state not in TARGET_STATES:
                continue

            records.append({
                "agency_name":       agency,
                "title":             title,
                "event_type":        infer_event_type(title),
                "service_type":      infer_service_type(title),
                "issue_date":        _parse_date(cells[issue_idx]) if issue_idx and issue_idx < len(cells) else None,
                "due_date":          _parse_date(cells[due_idx]) if due_idx and due_idx < len(cells) else None,
                "status":            _normalize_status(cells[status_idx]) if status_idx and status_idx < len(cells) else "active",
                "estimated_value":   _parse_dollar(cells[value_idx]) if value_idx and value_idx < len(cells) else None,
                "portal_name":       portal_name,
                "source_url":        source_url,
                "state":             state,
            })
    return records


def _is_relevant_solicitation(title: str) -> bool:
    """Return True if the title matches any of our target procurement keywords."""
    title_lower = title.lower()
    return any(kw.lower() in title_lower for kw in PROCUREMENT_KEYWORDS)


# ---------------------------------------------------------------------------
# Aggregate scrape function
# ---------------------------------------------------------------------------

def scrape_all_portals(states: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    """Run all procurement portal scrapers and merge results."""
    all_records: List[Dict[str, Any]] = []

    all_records.extend(scrape_planetbids(states))
    all_records.extend(scrape_bidnet(states))

    logger.info(f"Procurement total: {len(all_records)} records across all portals")
    return all_records


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def _find_col(headers: List[str], keywords: List[str]) -> Optional[int]:
    for i, h in enumerate(headers):
        for kw in keywords:
            if kw in h:
                return i
    return None


def _parse_date(s) -> Optional[date]:
    if not s:
        return None
    if isinstance(s, date):
        return s
    s = str(s).strip()
    from dateutil import parser as dp
    try:
        return dp.parse(s, fuzzy=True).date()
    except Exception:
        for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%B %d, %Y", "%b %d, %Y"):
            try:
                return datetime.strptime(s, fmt).date()
            except ValueError:
                continue
    return None


def _parse_dollar(s: str) -> Optional[float]:
    if not s:
        return None
    s = s.strip().replace(",", "").replace("$", "")
    multiplier = 1.0
    if "million" in s.lower() or s.lower().endswith("m"):
        multiplier = 1_000_000
        s = re.sub(r"(million|m)$", "", s, flags=re.I).strip()
    elif "billion" in s.lower() or s.lower().endswith("b"):
        multiplier = 1_000_000_000
        s = re.sub(r"(billion|b)$", "", s, flags=re.I).strip()
    try:
        return float(s) * multiplier
    except ValueError:
        return None


def _normalize_status(s: str) -> str:
    s = s.lower().strip()
    if any(w in s for w in ["open", "active", "current", "posted"]):
        return "active"
    if any(w in s for w in ["closed", "expired", "past"]):
        return "closed"
    if any(w in s for w in ["award", "contract"]):
        return "awarded"
    if "cancel" in s:
        return "cancelled"
    return "active"
