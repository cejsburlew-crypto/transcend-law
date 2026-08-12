"""
Pipeline loader — writes normalised records into the SQLite database.

Handles upsert logic for all entity types using the database helpers.
"""

from __future__ import annotations

import hashlib
import json
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

from loguru import logger
from sqlalchemy.orm import Session
from sqlalchemy import select

from database import get_session, upsert_agency
from models import (
    Agency, BondMeasure, ProcurementEvent, SourceDocument,
    ScrapeRun,
)


# ---------------------------------------------------------------------------
# Public load functions
# ---------------------------------------------------------------------------

def load_bond_measures(
    records: List[Dict[str, Any]],
    scrape_run: Optional[ScrapeRun] = None,
) -> Dict[str, int]:
    """
    Upsert a list of normalised bond measure records.
    Returns stats: {added, updated, skipped}.
    """
    stats = {"added": 0, "updated": 0, "skipped": 0}

    with get_session() as session:
        for rec in records:
            try:
                _load_bond_measure(session, rec, stats)
            except Exception as exc:
                logger.warning(f"Loader: bond measure error for '{rec.get('name')}': {exc}")
                stats["skipped"] += 1
                if scrape_run:
                    scrape_run.log_error(f"Bond measure '{rec.get('name')}': {exc}")

        if scrape_run:
            session.add(scrape_run)

    logger.info(
        f"Bond measures loaded — added={stats['added']} "
        f"updated={stats['updated']} skipped={stats['skipped']}"
    )
    return stats


def load_procurement_events(
    records: List[Dict[str, Any]],
    scrape_run: Optional[ScrapeRun] = None,
) -> Dict[str, int]:
    """
    Upsert a list of normalised procurement event records.
    Attempts to match events to existing agencies by name.
    """
    stats = {"added": 0, "updated": 0, "skipped": 0}

    with get_session() as session:
        for rec in records:
            try:
                _load_procurement_event(session, rec, stats)
            except Exception as exc:
                logger.warning(f"Loader: procurement error for '{rec.get('title')}': {exc}")
                stats["skipped"] += 1

        if scrape_run:
            session.add(scrape_run)

    logger.info(
        f"Procurement events loaded — added={stats['added']} "
        f"updated={stats['updated']} skipped={stats['skipped']}"
    )
    return stats


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _load_bond_measure(
    session: Session,
    rec: Dict[str, Any],
    stats: Dict[str, int],
) -> None:
    # 1. Upsert agency
    agency, agency_created = upsert_agency(session, rec)
    session.flush()  # get agency.id

    # 2. Record source document
    source_url = rec.get("source_url", "")
    if source_url:
        _upsert_source_doc(session, agency.id, source_url, "election_result", rec.get("state"))

    # 3. Upsert bond measure
    measure_name  = rec.get("measure_name") or ""
    election_date = rec.get("election_date")
    if not election_date:
        stats["skipped"] += 1
        return

    existing = session.execute(
        select(BondMeasure).where(
            BondMeasure.agency_id    == agency.id,
            BondMeasure.measure_name == measure_name,
            BondMeasure.election_date == _coerce_date(election_date),
        )
    ).scalars().first()

    if existing:
        _update_bond_measure(existing, rec)
        stats["updated"] += 1
    else:
        bm = BondMeasure(
            agency_id           = agency.id,
            measure_name        = measure_name,
            measure_letter      = rec.get("measure_letter") or "",
            election_date       = _coerce_date(election_date),
            election_type       = rec.get("election_type") or "general",
            bond_amount         = rec.get("bond_amount"),
            authorized_amount   = rec.get("authorized_amount"),
            issued_amount       = rec.get("issued_amount"),
            unissued_amount     = rec.get("unissued_amount"),
            passed              = rec.get("result") == "passed",
            vote_percentage     = rec.get("vote_pct"),
            votes_yes           = rec.get("votes_yes"),
            votes_no            = rec.get("votes_no"),
            required_threshold  = rec.get("required_threshold") or 55.0,
            purpose_description = rec.get("bond_purpose") or "",
            project_categories  = rec.get("project_categories") or [],
            state               = rec.get("state", ""),
            source_url          = source_url,
            raw_data            = _safe_raw(rec.get("raw_data")),
        )
        session.add(bm)
        stats["added"] += 1


def _update_bond_measure(bm: BondMeasure, rec: Dict[str, Any]) -> None:
    """Merge new data into an existing BondMeasure, preferring non-null values."""
    if rec.get("bond_amount") and not bm.bond_amount:
        bm.bond_amount = rec["bond_amount"]
    if rec.get("authorized_amount") and not bm.authorized_amount:
        bm.authorized_amount = rec["authorized_amount"]
    if rec.get("unissued_amount") and not bm.unissued_amount:
        bm.unissued_amount = rec["unissued_amount"]
    if rec.get("vote_pct") and not bm.vote_percentage:
        bm.vote_percentage = rec["vote_pct"]
    if rec.get("votes_yes") and not bm.votes_yes:
        bm.votes_yes = rec["votes_yes"]
    if rec.get("votes_no") and not bm.votes_no:
        bm.votes_no = rec["votes_no"]
    # Always update result if we now have a definitive answer
    result = rec.get("result")
    if result in ("passed", "failed"):
        bm.passed = result == "passed"
    if rec.get("project_categories") and not bm.project_categories:
        bm.project_categories = rec["project_categories"]


def _load_procurement_event(
    session: Session,
    rec: Dict[str, Any],
    stats: Dict[str, int],
) -> None:
    # Try to find matching agency
    agency_id = _resolve_agency_id(session, rec.get("agency_name", ""), rec.get("state"))

    title      = rec.get("title", "")
    issue_date = _coerce_date(rec.get("issue_date"))

    existing = session.execute(
        select(ProcurementEvent).where(
            ProcurementEvent.title      == title,
            ProcurementEvent.issue_date == issue_date,
        )
    ).scalars().first()

    if existing:
        # Update status and due date
        if rec.get("status"):
            existing.status = rec["status"]
        if rec.get("due_date") and not existing.due_date:
            existing.due_date = _coerce_date(rec["due_date"])
        if agency_id and not existing.agency_id:
            existing.agency_id = agency_id
        stats["updated"] += 1
    else:
        pe = ProcurementEvent(
            agency_id       = agency_id,
            title           = title,
            event_type      = rec.get("event_type") or "rfq_issued",
            service_type    = rec.get("service_type") or "other",
            issue_date      = issue_date,
            due_date        = _coerce_date(rec.get("due_date")),
            estimated_value = rec.get("estimated_value"),
            status          = rec.get("status") or "active",
            description     = rec.get("description") or "",
            contact_name    = rec.get("contact_name") or "",
            contact_email   = rec.get("contact_email") or "",
            source_url      = rec.get("source_url") or "",
            portal_name     = rec.get("portal_name") or "",
            state           = rec.get("state") or "",
            raw_data        = _safe_raw(rec.get("raw_data")),
        )
        session.add(pe)
        stats["added"] += 1


def _upsert_source_doc(
    session: Session,
    agency_id: int,
    url: str,
    doc_type: str,
    state: Optional[str],
) -> None:
    url_hash = hashlib.sha256(url.encode()).hexdigest()
    existing = session.execute(
        select(SourceDocument).where(SourceDocument.url_hash == url_hash)
    ).scalars().first()

    if existing:
        existing.scraped_at = datetime.utcnow()
        if agency_id and not existing.agency_id:
            existing.agency_id = agency_id
    else:
        doc = SourceDocument(
            agency_id  = agency_id,
            url        = url,
            url_hash   = url_hash,
            doc_type   = doc_type,
            scraped_at = datetime.utcnow(),
            state      = state,
        )
        session.add(doc)


def _resolve_agency_id(
    session: Session,
    agency_name: str,
    state: Optional[str],
) -> Optional[int]:
    """Fuzzy-find agency_id from name + state."""
    if not agency_name:
        return None

    from database import normalize_agency_name
    norm = normalize_agency_name(agency_name)

    filters = [Agency.normalized_name == norm]
    if state and len(state) == 2:
        filters.append(Agency.state == state.upper())

    agency = session.execute(
        select(Agency).where(*filters)
    ).scalars().first()

    if agency:
        return agency.id

    # Partial match fallback
    agency = session.execute(
        select(Agency).where(Agency.normalized_name.like(f"%{norm[:15]}%"))
    ).scalars().first()

    return agency.id if agency else None


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
        return None


def _safe_raw(val: Any) -> Optional[dict]:
    if val is None:
        return None
    if isinstance(val, dict):
        # Remove non-serialisable values
        try:
            json.dumps(val)
            return val
        except (TypeError, ValueError):
            return {"error": "non-serialisable raw data"}
    return None
