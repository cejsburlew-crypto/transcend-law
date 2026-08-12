"""
Pipeline normalizer — cleans and standardises raw scraper output into
a consistent shape before the loader writes to the database.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from loguru import logger

from config import PROJECT_CATEGORIES


# ---------------------------------------------------------------------------
# Bond measure normalizer
# ---------------------------------------------------------------------------

def normalize_bond_measure(raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Accept a raw dict from any scraper and return a normalised bond measure dict
    ready for the loader, or None if the record is too incomplete to use.
    """
    name = _clean_str(raw.get("name") or raw.get("agency_name") or "")
    if not name or len(name) < 3:
        return None

    state = _clean_str(raw.get("state", "")).upper()
    if len(state) != 2:
        return None

    election_date = _coerce_date(raw.get("election_date"))
    if election_date is None:
        # If we have a year at minimum, use Nov 1 as default
        year_match = re.search(r"\b(20\d\d)\b", str(raw.get("election_date", "")))
        if year_match:
            election_date = date(int(year_match.group(1)), 11, 1)
        else:
            return None

    passed_raw = raw.get("passed")
    if isinstance(passed_raw, bool):
        passed = passed_raw
    elif isinstance(passed_raw, int):
        passed = bool(passed_raw)
    elif isinstance(passed_raw, str):
        passed = _parse_bool_str(passed_raw)
    else:
        passed = None

    result_str = raw.get("result", "")
    if passed is None and isinstance(result_str, str):
        passed = _parse_bool_str(result_str)

    vote_pct = _coerce_float(raw.get("vote_percentage") or raw.get("vote_pct"))

    bond_amount      = _coerce_float(raw.get("bond_amount"))
    authorized_amount = _coerce_float(raw.get("authorized_amount"))
    unissued_amount  = _coerce_float(raw.get("unissued_amount"))
    issued_amount    = _coerce_float(raw.get("issued_amount"))

    # Derive unissued if we have auth but no unissued
    if authorized_amount and issued_amount and unissued_amount is None:
        unissued_amount = max(0.0, authorized_amount - issued_amount)

    # Normalize project categories
    categories = _normalize_categories(raw.get("project_categories") or raw.get("bond_purpose") or "")

    # Determine measure result field used by CI4 backend
    if passed is True:
        result = "passed"
    elif passed is False:
        result = "failed"
    elif result_str and "pending" in str(result_str).lower():
        result = "pending"
    else:
        result = "pending"

    return {
        "name":               name,
        "state":              state,
        "county":             _clean_str(raw.get("county")),
        "city":               _clean_str(raw.get("city")),
        "agency_type":        _clean_str(raw.get("agency_type") or "other"),
        "website":            _clean_str(raw.get("website")),
        "measure_name":       _clean_str(raw.get("measure_name") or raw.get("measure_letter") or ""),
        "measure_letter":     _clean_str(raw.get("measure_letter") or ""),
        "election_date":      election_date.isoformat(),
        "election_type":      _clean_str(raw.get("election_type") or "general"),
        "bond_amount":        bond_amount,
        "authorized_amount":  authorized_amount,
        "issued_amount":      issued_amount,
        "unissued_amount":    unissued_amount,
        "result":             result,
        "vote_pct":           vote_pct,
        "votes_yes":          _coerce_int(raw.get("votes_yes")),
        "votes_no":           _coerce_int(raw.get("votes_no")),
        "required_threshold": _coerce_float(raw.get("required_threshold") or 55.0),
        "bond_purpose":       _clean_str(raw.get("purpose_description") or raw.get("bond_purpose") or ""),
        "project_categories": categories,
        "source_url":         _clean_str(raw.get("source_url") or ""),
        "raw_data":           raw,
    }


# ---------------------------------------------------------------------------
# Procurement event normalizer
# ---------------------------------------------------------------------------

def normalize_procurement_event(raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Normalise a raw procurement record from any portal scraper.
    """
    title = _clean_str(raw.get("title") or "")
    if not title or len(title) < 5:
        return None

    agency_name = _clean_str(raw.get("agency_name") or raw.get("name") or "")
    state = _clean_str(raw.get("state") or "").upper()

    issue_date = _coerce_date(raw.get("issue_date"))
    due_date   = _coerce_date(raw.get("due_date"))

    # Skip if both dates are in the past by more than 2 years
    now = date.today()
    if due_date and (now - due_date).days > 730:
        return None

    status = _clean_str(raw.get("status") or "active").lower()
    if status not in ("active", "closed", "awarded", "cancelled"):
        status = "active"

    return {
        "agency_name":     agency_name,
        "state":           state if len(state) == 2 else None,
        "title":           title,
        "event_type":      _clean_str(raw.get("event_type") or "rfq_issued"),
        "service_type":    _clean_str(raw.get("service_type") or "other"),
        "issue_date":      issue_date.isoformat() if issue_date else None,
        "due_date":        due_date.isoformat() if due_date else None,
        "estimated_value": _coerce_float(raw.get("estimated_value")),
        "status":          status,
        "description":     _clean_str(raw.get("description") or ""),
        "contact_name":    _clean_str(raw.get("contact_name") or ""),
        "contact_email":   _clean_str(raw.get("contact_email") or ""),
        "portal_name":     _clean_str(raw.get("portal_name") or ""),
        "source_url":      _clean_str(raw.get("source_url") or ""),
        "raw_data":        raw,
    }


# ---------------------------------------------------------------------------
# Batch normalizers
# ---------------------------------------------------------------------------

def normalize_bond_measures(raw_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    results = []
    skipped = 0
    for raw in raw_list:
        norm = normalize_bond_measure(raw)
        if norm:
            results.append(norm)
        else:
            skipped += 1
    if skipped:
        logger.debug(f"Normalizer: skipped {skipped}/{len(raw_list)} incomplete bond records")
    return results


def normalize_procurement_events(raw_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    results = []
    skipped = 0
    for raw in raw_list:
        norm = normalize_procurement_event(raw)
        if norm:
            results.append(norm)
        else:
            skipped += 1
    if skipped:
        logger.debug(f"Normalizer: skipped {skipped}/{len(raw_list)} incomplete procurement records")
    return results


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clean_str(val: Any) -> str:
    if val is None:
        return ""
    s = str(val).strip()
    # Remove multiple spaces
    s = re.sub(r"\s{2,}", " ", s)
    return s


def _coerce_date(val: Any) -> Optional[date]:
    if val is None:
        return None
    if isinstance(val, date):
        return val
    if isinstance(val, datetime):
        return val.date()
    s = str(val).strip()
    if not s:
        return None
    from dateutil import parser as dp
    try:
        return dp.parse(s, fuzzy=True).date()
    except Exception:
        for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%B %d, %Y", "%b %d, %Y", "%m-%d-%Y"):
            try:
                return datetime.strptime(s, fmt).date()
            except ValueError:
                continue
    return None


def _coerce_float(val: Any) -> Optional[float]:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip().replace(",", "").replace("$", "").replace(" ", "")
    multiplier = 1.0
    if s.lower().endswith("b"):
        multiplier = 1_000_000_000; s = s[:-1]
    elif s.lower().endswith("m"):
        multiplier = 1_000_000; s = s[:-1]
    elif s.lower().endswith("k"):
        multiplier = 1_000; s = s[:-1]
    try:
        return float(s) * multiplier
    except (ValueError, TypeError):
        return None


def _coerce_int(val: Any) -> Optional[int]:
    if val is None:
        return None
    try:
        return int(str(val).replace(",", "").strip())
    except (ValueError, TypeError):
        return None


def _parse_bool_str(s: str) -> Optional[bool]:
    s = str(s).lower().strip()
    if s in ("yes", "passed", "approved", "true", "1", "p", "won"):
        return True
    if s in ("no", "failed", "rejected", "false", "0", "f", "lost", "defeated"):
        return False
    return None


def _normalize_categories(val: Any) -> list:
    """Map free-text purpose/categories to the PROJECT_CATEGORIES taxonomy."""
    if isinstance(val, list):
        # Already a list — filter to known values
        return [c for c in val if c in PROJECT_CATEGORIES]

    if not val:
        return []

    text = str(val).lower()
    matched = []

    keyword_map = {
        "new construction":      "new_construction",
        "new school":            "new_construction",
        "modernization":         "modernization",
        "renovation":            "modernization",
        "upgrade":               "modernization",
        "safety":                "safety_security",
        "security":              "safety_security",
        "technology":            "technology",
        "stem":                  "stem_facilities",
        "lab":                   "stem_facilities",
        "athletic":              "athletics",
        "sport":                 "athletics",
        "field":                 "athletics",
        "early childhood":       "early_childhood",
        "preschool":             "early_childhood",
        "pre-k":                 "early_childhood",
        "water":                 "water_infrastructure",
        "sewer":                 "water_infrastructure",
        "energy":                "energy_efficiency",
        "solar":                 "energy_efficiency",
        "seismic":               "seismic_retrofit",
        "earthquake":            "seismic_retrofit",
        "transportation":        "transportation",
        "bus":                   "transportation",
        "deferred":              "deferred_maintenance",
        "maintenance":           "deferred_maintenance",
        "repair":                "deferred_maintenance",
    }

    for kw, cat in keyword_map.items():
        if kw in text and cat not in matched:
            matched.append(cat)

    return matched or ["modernization"]
