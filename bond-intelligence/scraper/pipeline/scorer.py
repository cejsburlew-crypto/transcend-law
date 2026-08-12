"""
Pipeline scorer — Python-side lead scoring.

Mirrors the logic in the PHP LeadScoringService so the scraper can
update scores immediately after loading new data, without an HTTP round-trip
to the CI4 API.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

from loguru import logger
from sqlalchemy.orm import Session
from sqlalchemy import select

from database import get_session
from models import Agency, BondMeasure, Consultant, ProcurementEvent, SourceDocument, LeadScore


# ---------------------------------------------------------------------------
# Scoring constants
# ---------------------------------------------------------------------------

SCORE_BOND_12MO      = 40
SCORE_BOND_24MO      = 25
SCORE_BOND_OLD       = 15
SCORE_BOND_PENDING   = 20
SCORE_BOND_FAILED    = -20

SCORE_AMT_500M       = 20
SCORE_AMT_100M       = 15
SCORE_AMT_50M        = 10
SCORE_AMT_25M        = 5

SCORE_UNISSUED_50PCT = 10

SCORE_RFQ_ACTIVE     = 15
SCORE_BOARD_APPROVAL = 5

SCORE_NO_PM          = 10
SCORE_NO_CM          = 5
SCORE_NO_INSPECTOR   = 3
SCORE_ALL_FILLED     = -15

SCORE_MULTI_SCOPE    = 5
SCORE_STALE          = -10

HOT_THRESHOLD  = 70
WARM_THRESHOLD = 50
COOL_THRESHOLD = 30

APPROACH_NOW_STAGES = {"bond_passed", "rfq_expected", "rfq_active"}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def score_agency(agency_id: int) -> Optional[Dict[str, Any]]:
    """Score a single agency and upsert the result into lead_scores."""
    with get_session() as session:
        agency = session.get(Agency, agency_id)
        if not agency:
            return None

        bond_measures = session.execute(
            select(BondMeasure)
            .where(BondMeasure.agency_id == agency_id)
            .order_by(BondMeasure.election_date.desc())
        ).scalars().all()

        consultants = session.execute(
            select(Consultant).where(Consultant.agency_id == agency_id)
        ).scalars().all()

        procurements = session.execute(
            select(ProcurementEvent).where(ProcurementEvent.agency_id == agency_id)
        ).scalars().all()

        source_docs = session.execute(
            select(SourceDocument).where(SourceDocument.agency_id == agency_id)
        ).scalars().all()

        result = _compute_score(agency, bond_measures, consultants, procurements, source_docs)
        _upsert_lead_score(session, agency_id, result)

    return result


def batch_score_all() -> Dict[str, int]:
    """Score every agency. Returns {scored, errors}."""
    stats = {"scored": 0, "errors": 0}
    with get_session() as session:
        agency_ids = session.execute(select(Agency.id)).scalars().all()

    for aid in agency_ids:
        try:
            score_agency(aid)
            stats["scored"] += 1
        except Exception as exc:
            logger.error(f"Scorer: agency_id={aid}: {exc}")
            stats["errors"] += 1

    logger.info(f"Batch score complete — {stats}")
    return stats


# ---------------------------------------------------------------------------
# Core scoring engine
# ---------------------------------------------------------------------------

def _compute_score(
    agency: Agency,
    bond_measures: List[BondMeasure],
    consultants: List[Consultant],
    procurements: List[ProcurementEvent],
    source_docs: List[SourceDocument],
) -> Dict[str, Any]:
    score   = 0
    factors: List[Dict[str, Any]] = []

    today = date.today()

    # ---- Bond result ----
    passed_bond  = next((b for b in bond_measures if b.passed is True),  None)
    pending_bond = next((b for b in bond_measures if b.passed is None),  None)
    failed_bond  = next((b for b in bond_measures if b.passed is False), None)

    if passed_bond:
        days_ago = (today - passed_bond.election_date).days if passed_bond.election_date else 9999
        if days_ago <= 365:
            score += SCORE_BOND_12MO
            factors.append(_f("bond_recent_12mo", SCORE_BOND_12MO, "Bond passed within 12 months"))
        elif days_ago <= 730:
            score += SCORE_BOND_24MO
            factors.append(_f("bond_passed_24mo", SCORE_BOND_24MO, "Bond passed within 24 months"))
        else:
            score += SCORE_BOND_OLD
            factors.append(_f("bond_passed_old", SCORE_BOND_OLD, "Bond passed (over 24 months ago)"))
    elif pending_bond:
        score += SCORE_BOND_PENDING
        factors.append(_f("bond_pending", SCORE_BOND_PENDING, "Bond measure pending / on ballot"))
    elif failed_bond and not procurements:
        score += SCORE_BOND_FAILED
        factors.append(_f("bond_failed", SCORE_BOND_FAILED, "Bond failed with no procurement signals"))

    # ---- Bond amount ----
    max_amount = max((b.bond_amount or 0 for b in bond_measures), default=0)
    if max_amount > 500_000_000:
        score += SCORE_AMT_500M; factors.append(_f("amount_500m", SCORE_AMT_500M, "Bond amount > $500M"))
    elif max_amount > 100_000_000:
        score += SCORE_AMT_100M; factors.append(_f("amount_100m", SCORE_AMT_100M, "Bond amount > $100M"))
    elif max_amount > 50_000_000:
        score += SCORE_AMT_50M;  factors.append(_f("amount_50m",  SCORE_AMT_50M,  "Bond amount > $50M"))
    elif max_amount > 25_000_000:
        score += SCORE_AMT_25M;  factors.append(_f("amount_25m",  SCORE_AMT_25M,  "Bond amount > $25M"))

    # ---- Unissued ratio ----
    for bm in bond_measures:
        auth    = bm.authorized_amount or 0
        issued  = bm.issued_amount or 0
        unissued = bm.unissued_amount if bm.unissued_amount is not None else max(0, auth - issued)
        if auth > 0 and unissued / auth > 0.5:
            score += SCORE_UNISSUED_50PCT
            factors.append(_f("unissued_50pct", SCORE_UNISSUED_50PCT, "Over 50% of authorized amount is unissued"))
            break

    # ---- Procurement signals ----
    has_rfq = any(p.event_type in ("rfq_issued", "rfp_issued") for p in procurements)
    if has_rfq:
        score += SCORE_RFQ_ACTIVE
        factors.append(_f("rfq_active", SCORE_RFQ_ACTIVE, "Active RFQ or RFP procurement event found"))

    if any(p.event_type == "board_approval" for p in procurements):
        score += SCORE_BOARD_APPROVAL
        factors.append(_f("board_approval", SCORE_BOARD_APPROVAL, "Board approval of bond program found"))

    # ---- Consultant gaps ----
    awarded_types = {c.service_type for c in consultants}
    if "program_manager"    not in awarded_types: score += SCORE_NO_PM;       factors.append(_f("no_pm",       SCORE_NO_PM,       "No program manager on record"))
    if "construction_manager" not in awarded_types: score += SCORE_NO_CM;     factors.append(_f("no_cm",       SCORE_NO_CM,       "No construction manager on record"))
    if "inspector"          not in awarded_types: score += SCORE_NO_INSPECTOR; factors.append(_f("no_inspector",SCORE_NO_INSPECTOR,"No inspector of record on record"))

    key_types = {"program_manager", "construction_manager", "inspector"}
    if key_types.issubset(awarded_types):
        score += SCORE_ALL_FILLED
        factors.append(_f("all_roles_filled", SCORE_ALL_FILLED, "All major consultant roles appear awarded"))

    # ---- Multi-scope ----
    all_cats: List[str] = []
    for bm in bond_measures:
        if isinstance(bm.project_categories, list):
            all_cats.extend(bm.project_categories)
    if len(set(all_cats)) >= 3:
        score += SCORE_MULTI_SCOPE
        factors.append(_f("multi_scope", SCORE_MULTI_SCOPE, "Multi-scope program (3+ project categories)"))

    # ---- Staleness ----
    stale = bool(source_docs)
    for doc in source_docs:
        if doc.scraped_at and (datetime.utcnow() - doc.scraped_at).days < 180:
            stale = False
            break
    if stale:
        score += SCORE_STALE
        factors.append(_f("stale", SCORE_STALE, "All source documents older than 180 days"))

    score = max(0, min(100, score))

    # ---- Confidence ----
    confidence = 50 + min(25, len(source_docs) * 5)
    if source_docs:
        age_days = (datetime.utcnow() - source_docs[0].scraped_at).days if source_docs[0].scraped_at else 999
        if age_days < 30:  confidence += 15
        elif age_days < 90: confidence += 10
    if len(source_docs) < 2:
        confidence -= 10
    confidence = max(0, min(100, confidence))

    # ---- Stage ----
    stage = _determine_stage(passed_bond, pending_bond, failed_bond, has_rfq, awarded_types)
    approach_now = score >= HOT_THRESHOLD and stage in APPROACH_NOW_STAGES

    return {
        "score":                      score,
        "confidence":                 confidence,
        "opportunity_stage":          stage,
        "approach_now":               approach_now,
        "scoring_factors":            factors,
        "estimated_next_action":      _next_action(stage, procurements),
        "recommended_outreach_angle": _outreach_angle(agency, passed_bond, stage),
    }


def _determine_stage(
    passed_bond: Optional[BondMeasure],
    pending_bond: Optional[BondMeasure],
    failed_bond: Optional[BondMeasure],
    has_rfq: bool,
    awarded_types: set,
) -> str:
    key_types = {"program_manager", "construction_manager", "inspector"}
    if has_rfq:
        return "rfq_active"
    if passed_bond:
        if "program_manager" not in awarded_types:
            return "bond_passed"
        if key_types.issubset(awarded_types):
            return "construction_active"
        return "consultant_awarded"
    if pending_bond:
        return "rfq_expected"
    if failed_bond:
        return "bond_failed_retry"
    return "bond_passed"


def _next_action(stage: str, procurements: List[ProcurementEvent]) -> str:
    next_due = None
    for p in procurements:
        if p.due_date and (next_due is None or p.due_date < next_due):
            next_due = p.due_date

    actions = {
        "bond_passed":         "Reach out to Facilities Director and CBO within 30 days before first solicitation.",
        "rfq_active":          f"Submit qualifications before {next_due.isoformat() if next_due else 'due date'}. Prepare SOQ.",
        "rfq_expected":        "Schedule intro meeting with procurement contact before RFQ drops.",
        "consultant_awarded":  "Monitor board agendas for PMIS, materials testing, and specialty RFQs.",
        "bond_failed_retry":   "Follow next election cycle. Offer facilities assessment or pre-bond planning.",
        "construction_active": "Monitor for inspector, testing, or closeout support opportunities.",
    }
    return actions.get(stage, "Monitor agency website and board agendas for capital program activity.")


def _outreach_angle(agency: Agency, bond: Optional[BondMeasure], stage: str) -> str:
    name   = agency.name
    amount = f"${bond.bond_amount/1e6:.0f}M" if bond and bond.bond_amount else ""
    measure = (bond.measure_name or "bond measure") if bond else "bond program"
    angles = {
        "bond_passed":        f"Congratulations to {name} on {measure} passing{' (' + amount + ')' if amount else ''}. Transcend PM provides owner-side program governance, procurement strategy, and PMIS from day one.",
        "rfq_active":         f"{name} has an active procurement. Transcend PM responds with proven capital program experience in school modernization, occupied campus construction, and DSA closeout.",
        "rfq_expected":       f"With {amount} authorized and procurement expected soon, now is the time to establish a relationship with {name} before the first RFQ drops.",
        "consultant_awarded": f"{name} has a program manager in place, but gaps in PMIS or inspection may exist. Transcend PM offers specialized owner-side support.",
        "bond_failed_retry":  f"Bond measures often take multiple elections. Transcend PM can help {name} build community confidence through transparent capital planning.",
    }
    return angles.get(stage, f"Transcend PM offers {name} experienced owner-side capital program support.")


def _upsert_lead_score(session: Session, agency_id: int, result: Dict[str, Any]) -> None:
    existing = session.execute(
        select(LeadScore).where(LeadScore.agency_id == agency_id)
    ).scalars().first()

    if existing:
        existing.total_score       = result["score"]
        existing.confidence        = result["confidence"]
        existing.opportunity_stage = result["opportunity_stage"]
        existing.approach_now      = result["approach_now"]
        existing.factors           = result["scoring_factors"]
        existing.scored_at         = datetime.utcnow()
    else:
        ls = LeadScore(
            agency_id         = agency_id,
            total_score       = result["score"],
            confidence        = result["confidence"],
            opportunity_stage = result["opportunity_stage"],
            approach_now      = result["approach_now"],
            factors           = result["scoring_factors"],
            scored_at         = datetime.utcnow(),
        )
        session.add(ls)


def _f(key: str, points: int, reason: str) -> Dict[str, Any]:
    return {"key": key, "points": points, "reason": reason}
