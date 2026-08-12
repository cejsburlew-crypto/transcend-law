"""
Bond Intelligence — SQLAlchemy ORM models.
Mirrors the Laravel migrations exactly.
"""

from __future__ import annotations

import json
from datetime import datetime, date
from typing import Optional, List

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Float, ForeignKey,
    Index, Integer, JSON, String, Text, UniqueConstraint,
    event,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, relationship, mapped_column
from sqlalchemy.sql import func


# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------

class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Agency
# ---------------------------------------------------------------------------

class Agency(Base):
    __tablename__ = "agencies"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    name            = Column(String(255), nullable=False)
    normalized_name = Column(String(255), nullable=False, index=True)
    agency_type     = Column(String(50), nullable=False, index=True)
    state           = Column(String(2),  nullable=False, index=True)
    county          = Column(String(100))
    city            = Column(String(100))
    zip_code        = Column(String(10))
    website         = Column(String(512))
    phone           = Column(String(30))
    enrollment      = Column(Integer)
    num_schools     = Column(Integer)
    # External IDs
    cdiac_id        = Column(String(50), index=True)
    ncesid          = Column(String(20))
    # Metadata
    source_url      = Column(String(1024))
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    bond_measures       = relationship("BondMeasure",      back_populates="agency", cascade="all, delete-orphan")
    contacts            = relationship("Contact",          back_populates="agency", cascade="all, delete-orphan")
    consultants         = relationship("Consultant",       back_populates="agency", cascade="all, delete-orphan")
    procurement_events  = relationship("ProcurementEvent", back_populates="agency", cascade="all, delete-orphan")
    source_documents    = relationship("SourceDocument",   back_populates="agency", cascade="all, delete-orphan")
    lead_score          = relationship("LeadScore",        back_populates="agency", uselist=False, cascade="all, delete-orphan")
    outreach_actions    = relationship("OutreachAction",   back_populates="agency", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("normalized_name", "state", name="uq_agency_norm_name_state"),
        Index("ix_agency_state_type", "state", "agency_type"),
    )

    def __repr__(self) -> str:
        return f"<Agency id={self.id} name={self.name!r} state={self.state}>"


# ---------------------------------------------------------------------------
# BondMeasure
# ---------------------------------------------------------------------------

class BondMeasure(Base):
    __tablename__ = "bond_measures"

    id                   = Column(Integer, primary_key=True, autoincrement=True)
    agency_id            = Column(Integer, ForeignKey("agencies.id", ondelete="CASCADE"), nullable=False, index=True)
    measure_name         = Column(String(100))
    measure_letter       = Column(String(10))
    election_date        = Column(Date, nullable=False, index=True)
    election_type        = Column(String(50))          # primary, general, special
    bond_amount          = Column(Float)
    authorized_amount    = Column(Float)
    unissued_amount      = Column(Float)
    passed               = Column(Boolean)
    vote_percentage      = Column(Float)
    votes_yes            = Column(Integer)
    votes_no             = Column(Integer)
    required_threshold   = Column(Float)               # 55.0 or 66.67
    purpose_description  = Column(Text)
    project_categories   = Column(JSON)                # list[str]
    state                = Column(String(2), nullable=False, index=True)
    source_url           = Column(String(1024))
    raw_data             = Column(JSON)
    created_at           = Column(DateTime, default=datetime.utcnow)
    updated_at           = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    agency = relationship("Agency", back_populates="bond_measures")

    __table_args__ = (
        UniqueConstraint("agency_id", "measure_name", "election_date", name="uq_bond_measure"),
        Index("ix_bond_state_date", "state", "election_date"),
        Index("ix_bond_passed", "passed"),
    )

    def __repr__(self) -> str:
        return (
            f"<BondMeasure id={self.id} measure={self.measure_name!r} "
            f"date={self.election_date} passed={self.passed}>"
        )


# ---------------------------------------------------------------------------
# Contact
# ---------------------------------------------------------------------------

class Contact(Base):
    __tablename__ = "contacts"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    agency_id    = Column(Integer, ForeignKey("agencies.id", ondelete="CASCADE"), nullable=False, index=True)
    name         = Column(String(255))
    title        = Column(String(255))
    email        = Column(String(255), index=True)
    phone        = Column(String(30))
    contact_type = Column(String(50))                  # superintendent, board_member, facilities_director, etc.
    source_url   = Column(String(1024))
    created_at   = Column(DateTime, default=datetime.utcnow)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    agency = relationship("Agency", back_populates="contacts")

    def __repr__(self) -> str:
        return f"<Contact id={self.id} name={self.name!r} agency_id={self.agency_id}>"


# ---------------------------------------------------------------------------
# Consultant
# ---------------------------------------------------------------------------

class Consultant(Base):
    __tablename__ = "consultants"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    agency_id       = Column(Integer, ForeignKey("agencies.id", ondelete="CASCADE"), nullable=False, index=True)
    firm_name       = Column(String(255), nullable=False)
    service_type    = Column(String(100), index=True)  # program_manager, construction_manager, inspector, etc.
    contract_amount = Column(Float)
    contract_date   = Column(Date)
    contract_end    = Column(Date)
    is_incumbent    = Column(Boolean, default=False)
    source_url      = Column(String(1024))
    notes           = Column(Text)
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    agency = relationship("Agency", back_populates="consultants")

    __table_args__ = (
        Index("ix_consultant_service", "agency_id", "service_type"),
    )

    def __repr__(self) -> str:
        return f"<Consultant id={self.id} firm={self.firm_name!r} service={self.service_type}>"


# ---------------------------------------------------------------------------
# ProcurementEvent
# ---------------------------------------------------------------------------

class ProcurementEvent(Base):
    __tablename__ = "procurement_events"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    agency_id        = Column(Integer, ForeignKey("agencies.id", ondelete="CASCADE"), nullable=False, index=True)
    title            = Column(String(512), nullable=False)
    event_type       = Column(String(50), index=True)  # rfq, rfp, rfei, iff, bid
    service_type     = Column(String(100), index=True)
    issue_date       = Column(Date, index=True)
    due_date         = Column(Date, index=True)
    estimated_value  = Column(Float)
    status           = Column(String(50), default="active", index=True)  # active, closed, awarded, cancelled
    description      = Column(Text)
    contact_name     = Column(String(255))
    contact_email    = Column(String(255))
    source_url       = Column(String(1024), nullable=False)
    portal_name      = Column(String(100))
    state            = Column(String(2), index=True)
    raw_data         = Column(JSON)
    created_at       = Column(DateTime, default=datetime.utcnow)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    agency = relationship("Agency", back_populates="procurement_events")

    __table_args__ = (
        UniqueConstraint("agency_id", "title", "issue_date", name="uq_procurement_event"),
        Index("ix_proc_state_status", "state", "status"),
    )

    def __repr__(self) -> str:
        return f"<ProcurementEvent id={self.id} title={self.title[:40]!r} status={self.status}>"


# ---------------------------------------------------------------------------
# SourceDocument
# ---------------------------------------------------------------------------

class SourceDocument(Base):
    __tablename__ = "source_documents"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    agency_id     = Column(Integer, ForeignKey("agencies.id", ondelete="CASCADE"), nullable=True, index=True)
    url           = Column(String(1024), nullable=False)
    url_hash      = Column(String(64), nullable=False, unique=True, index=True)
    doc_type      = Column(String(50))                  # election_result, bond_report, procurement, agenda, etc.
    title         = Column(String(512))
    published_date = Column(Date)
    scraped_at    = Column(DateTime, default=datetime.utcnow)
    local_path    = Column(String(1024))
    content_hash  = Column(String(64))
    state         = Column(String(2))
    created_at    = Column(DateTime, default=datetime.utcnow)
    updated_at    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    agency = relationship("Agency", back_populates="source_documents")

    def __repr__(self) -> str:
        return f"<SourceDocument id={self.id} url_hash={self.url_hash} type={self.doc_type}>"


# ---------------------------------------------------------------------------
# LeadScore
# ---------------------------------------------------------------------------

class LeadScore(Base):
    __tablename__ = "lead_scores"

    id                  = Column(Integer, primary_key=True, autoincrement=True)
    agency_id           = Column(Integer, ForeignKey("agencies.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    total_score         = Column(Integer, default=0, index=True)
    confidence          = Column(Float, default=0.0)
    opportunity_stage   = Column(String(50), index=True)   # cold, warming, hot, active, closed
    approach_now        = Column(Boolean, default=False, index=True)
    factors             = Column(JSON)                     # dict of factor_name → score_delta
    scored_at           = Column(DateTime, default=datetime.utcnow)
    created_at          = Column(DateTime, default=datetime.utcnow)
    updated_at          = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    agency = relationship("Agency", back_populates="lead_score")

    __table_args__ = (
        Index("ix_lead_stage_score", "opportunity_stage", "total_score"),
    )

    def __repr__(self) -> str:
        return (
            f"<LeadScore agency_id={self.agency_id} score={self.total_score} "
            f"stage={self.opportunity_stage} approach_now={self.approach_now}>"
        )


# ---------------------------------------------------------------------------
# ScrapeRun
# ---------------------------------------------------------------------------

class ScrapeRun(Base):
    __tablename__ = "scrape_runs"

    id             = Column(Integer, primary_key=True, autoincrement=True)
    scraper_name   = Column(String(100), nullable=False, index=True)
    state          = Column(String(2), index=True)
    started_at     = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at   = Column(DateTime)
    status         = Column(String(20), default="running", index=True)  # running, complete, failed
    records_found  = Column(Integer, default=0)
    records_added  = Column(Integer, default=0)
    records_updated = Column(Integer, default=0)
    errors         = Column(JSON, default=list)
    notes          = Column(Text)

    def mark_complete(
        self,
        records_found: int = 0,
        records_added: int = 0,
        records_updated: int = 0,
        notes: str = "",
    ) -> None:
        self.status          = "complete"
        self.completed_at    = datetime.utcnow()
        self.records_found   = records_found
        self.records_added   = records_added
        self.records_updated = records_updated
        if notes:
            self.notes = notes

    def mark_failed(self, error_message: str) -> None:
        self.status       = "failed"
        self.completed_at = datetime.utcnow()
        errors = list(self.errors or [])
        errors.append({"time": datetime.utcnow().isoformat(), "error": error_message})
        self.errors = errors

    def log_error(self, error_message: str) -> None:
        errors = list(self.errors or [])
        errors.append({"time": datetime.utcnow().isoformat(), "error": error_message})
        self.errors = errors

    def __repr__(self) -> str:
        return (
            f"<ScrapeRun id={self.id} scraper={self.scraper_name!r} "
            f"state={self.state} status={self.status}>"
        )


# ---------------------------------------------------------------------------
# OutreachAction
# ---------------------------------------------------------------------------

class OutreachAction(Base):
    __tablename__ = "outreach_actions"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    agency_id       = Column(Integer, ForeignKey("agencies.id", ondelete="CASCADE"), nullable=False, index=True)
    action_type     = Column(String(50))    # email, call, linkedin, meeting, proposal
    contact_name    = Column(String(255))
    contact_email   = Column(String(255))
    notes           = Column(Text)
    outcome         = Column(String(100))
    action_date     = Column(Date, default=date.today, index=True)
    follow_up_date  = Column(Date)
    user_email      = Column(String(255))
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    agency = relationship("Agency", back_populates="outreach_actions")

    __table_args__ = (
        Index("ix_outreach_agency_date", "agency_id", "action_date"),
    )

    def __repr__(self) -> str:
        return f"<OutreachAction id={self.id} type={self.action_type} agency_id={self.agency_id}>"
