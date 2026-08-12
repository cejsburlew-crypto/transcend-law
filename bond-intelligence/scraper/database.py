"""
Bond Intelligence — database helpers.
"""

from __future__ import annotations

import hashlib
import re
import unicodedata
from contextlib import contextmanager
from typing import Generator, List, Optional, Tuple

try:
    from thefuzz import fuzz
except ImportError:
    from fuzzywuzzy import fuzz
from loguru import logger
from sqlalchemy import create_engine, select, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from config import DATABASE_URL
from models import Agency, Base

# ---------------------------------------------------------------------------
# Engine / session factory
# ---------------------------------------------------------------------------

_engine: Optional[Engine] = None
_SessionLocal: Optional[sessionmaker] = None


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        connect_args = {}
        if DATABASE_URL.startswith("sqlite"):
            connect_args = {"check_same_thread": False}
        _engine = create_engine(
            DATABASE_URL,
            echo=False,
            connect_args=connect_args,
        )
        logger.debug(f"Created engine for {DATABASE_URL}")
    return _engine


def _get_session_factory() -> sessionmaker:
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(
            bind=get_engine(),
            autocommit=False,
            autoflush=False,
            expire_on_commit=False,
        )
    return _SessionLocal


@contextmanager
def get_session() -> Generator[Session, None, None]:
    """Yield a transactional SQLAlchemy session; rolls back on error."""
    factory = _get_session_factory()
    session: Session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# ---------------------------------------------------------------------------
# Table initialisation
# ---------------------------------------------------------------------------

def init_db() -> None:
    """Create all tables (safe to call repeatedly)."""
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created / verified.")


# ---------------------------------------------------------------------------
# Agency name normalisation
# ---------------------------------------------------------------------------

_SUFFIX_MAP = {
    r"\bunified school district\b":   "usd",
    r"\bunified\b":                   "usd",
    r"\belementary school district\b": "esd",
    r"\bhigh school district\b":      "hsd",
    r"\bschool district\b":           "sd",
    r"\bcommunity college district\b": "ccd",
    r"\bcollege district\b":          "cd",
    r"\bmunicipality\b":              "municipality",
    r"\bcounty of\b":                 "county",
    r"\bcity of\b":                   "city",
    r"\bwater district\b":            "water dist",
    r"\bsanitary district\b":         "sanitary dist",
    r"\btransit district\b":          "transit dist",
    r"\bfire district\b":             "fire dist",
    r"\bhealth care district\b":      "health dist",
    r"\brecreation district\b":       "recreation dist",
    r"\bjoint powers authority\b":    "jpa",
}


def normalize_agency_name(name: str) -> str:
    """
    Return a canonical, lower-cased, punctuation-stripped version of *name*
    suitable for deduplication lookups.

    Steps:
    1. Unicode normalise → ASCII
    2. Lower-case
    3. Replace common suffixes with abbreviations
    4. Strip punctuation
    5. Collapse whitespace
    """
    # Unicode → ASCII (strips accents etc.)
    name = unicodedata.normalize("NFKD", name)
    name = name.encode("ascii", "ignore").decode("ascii")
    name = name.lower().strip()

    for pattern, replacement in _SUFFIX_MAP.items():
        name = re.sub(pattern, replacement, name)

    # Remove punctuation except hyphens and spaces
    name = re.sub(r"[^\w\s\-]", "", name)
    # Collapse whitespace
    name = re.sub(r"\s+", " ", name).strip()
    return name


# ---------------------------------------------------------------------------
# Upsert helpers
# ---------------------------------------------------------------------------

def upsert_agency(session: Session, record: dict) -> Tuple[Agency, bool]:
    """
    Find an existing agency by (normalized_name, state) or create a new one.

    Returns (agency, created) where created=True if a new row was inserted.
    """
    raw_name   = record.get("name", "").strip()
    state      = record.get("state", "").upper().strip()
    norm_name  = normalize_agency_name(raw_name)

    existing = (
        session.execute(
            select(Agency).where(
                Agency.normalized_name == norm_name,
                Agency.state == state,
            )
        )
        .scalars()
        .first()
    )

    if existing:
        # Update fields that may have become more complete
        _merge_agency_fields(existing, record)
        return existing, False

    agency = Agency(
        name            = raw_name,
        normalized_name = norm_name,
        state           = state,
        agency_type     = record.get("agency_type", "other"),
        county          = record.get("county"),
        city            = record.get("city"),
        zip_code        = record.get("zip_code"),
        website         = record.get("website"),
        phone           = record.get("phone"),
        enrollment      = record.get("enrollment"),
        num_schools     = record.get("num_schools"),
        cdiac_id        = record.get("cdiac_id"),
        ncesid          = record.get("ncesid"),
        source_url      = record.get("source_url"),
    )
    session.add(agency)
    return agency, True


def _merge_agency_fields(agency: Agency, record: dict) -> None:
    """Update nullable fields on an existing agency if the new record has better data."""
    simple_fields = [
        "county", "city", "zip_code", "website", "phone",
        "enrollment", "num_schools", "cdiac_id", "ncesid", "source_url",
    ]
    for field in simple_fields:
        new_val = record.get(field)
        if new_val and not getattr(agency, field):
            setattr(agency, field, new_val)

    # Prefer non-"other" agency_type
    new_type = record.get("agency_type")
    if new_type and new_type != "other" and agency.agency_type == "other":
        agency.agency_type = new_type


# ---------------------------------------------------------------------------
# Deduplication
# ---------------------------------------------------------------------------

def deduplicate_agencies(session: Session, score_threshold: int = 90) -> List[Tuple[int, int]]:
    """
    Find near-duplicate agencies within the same state using fuzzy matching.
    For each pair with similarity > score_threshold, merge the less-complete
    record into the more-complete one.

    Returns list of (merged_id, kept_id) tuples.
    """
    merged_pairs: List[Tuple[int, int]] = []

    # Group by state to limit comparisons
    states = session.execute(
        select(Agency.state).distinct()
    ).scalars().all()

    for state in states:
        agencies = (
            session.execute(
                select(Agency).where(Agency.state == state).order_by(Agency.id)
            )
            .scalars()
            .all()
        )

        # O(n²) comparison — acceptable since agencies per state is small
        for i, a1 in enumerate(agencies):
            for a2 in agencies[i + 1:]:
                sim = fuzz.token_sort_ratio(a1.normalized_name, a2.normalized_name)
                if sim >= score_threshold:
                    # Keep the one with more fields populated
                    score1 = _completeness_score(a1)
                    score2 = _completeness_score(a2)
                    keep   = a1 if score1 >= score2 else a2
                    discard = a2 if keep is a1 else a1

                    logger.info(
                        f"Merging duplicate agencies: "
                        f"'{discard.name}' (id={discard.id}) → '{keep.name}' (id={keep.id}), "
                        f"similarity={sim}"
                    )
                    _merge_agency_into(session, discard, keep)
                    merged_pairs.append((discard.id, keep.id))

    return merged_pairs


def _completeness_score(agency: Agency) -> int:
    """Count non-null fields as a proxy for record completeness."""
    fields = [
        agency.county, agency.city, agency.zip_code,
        agency.website, agency.phone, agency.enrollment,
        agency.num_schools, agency.cdiac_id, agency.ncesid,
    ]
    return sum(1 for f in fields if f is not None)


def _merge_agency_into(session: Session, discard: Agency, keep: Agency) -> None:
    """
    Re-parent all child records from *discard* to *keep*, then delete *discard*.
    """
    from models import (
        BondMeasure, Contact, Consultant,
        ProcurementEvent, SourceDocument, OutreachAction,
    )

    for model in (BondMeasure, Contact, Consultant, ProcurementEvent, SourceDocument, OutreachAction):
        session.execute(
            model.__table__.update()
            .where(model.__table__.c.agency_id == discard.id)
            .values(agency_id=keep.id)
        )

    # Merge fields
    _merge_agency_fields(keep, {
        "county":      discard.county,
        "city":        discard.city,
        "zip_code":    discard.zip_code,
        "website":     discard.website,
        "phone":       discard.phone,
        "enrollment":  discard.enrollment,
        "num_schools": discard.num_schools,
        "cdiac_id":    discard.cdiac_id,
        "ncesid":      discard.ncesid,
        "agency_type": discard.agency_type,
    })

    session.delete(discard)


# ---------------------------------------------------------------------------
# URL hashing helper (used by loader)
# ---------------------------------------------------------------------------

def url_hash(url: str) -> str:
    return hashlib.sha256(url.encode("utf-8")).hexdigest()
