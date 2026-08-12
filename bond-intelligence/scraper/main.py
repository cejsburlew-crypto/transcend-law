"""
Bond Intelligence Scraper — CLI entry point.

Usage:
  python main.py scrape --source cdiac
  python main.py scrape --source tx_brb --year 2024
  python main.py scrape --source ballotpedia --state CA
  python main.py scrape --source procurement
  python main.py scrape --source all
  python main.py score
  python main.py score --agency-id 42
  python main.py db init
  python main.py db dedup
"""

from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

import click
from loguru import logger

# Configure loguru before anything else
logger.remove()
logger.add(sys.stderr, level="INFO", format="<green>{time:HH:mm:ss}</green> | <level>{level}</level> | {message}")
logger.add("logs/scraper_{time:YYYY-MM-DD}.log", level="DEBUG", rotation="1 day", retention="30 days")


@click.group()
def cli():
    """Bond Intelligence Scraper for Transcend PM."""
    pass


# ---------------------------------------------------------------------------
# scrape command
# ---------------------------------------------------------------------------

@cli.command()
@click.option("--source", "-s", required=True,
              type=click.Choice(["cdiac", "ca_elections", "tx_brb", "ballotpedia", "procurement", "all"]),
              help="Which scraper to run")
@click.option("--state", default=None, help="Limit to a specific state (e.g. CA, TX)")
@click.option("--year", default=None, type=int, help="Limit to a specific year")
@click.option("--start-year", default=2018, type=int, help="Start year for historical scrapes (default 2018)")
@click.option("--dry-run", is_flag=True, help="Print records without writing to database")
def scrape(source: str, state: Optional[str], year: Optional[int], start_year: int, dry_run: bool):
    """Run one or all scrapers."""
    from database import init_db
    from models import ScrapeRun

    init_db()

    sources = ["cdiac", "ca_elections", "tx_brb", "ballotpedia", "procurement"] if source == "all" else [source]

    for src in sources:
        click.echo(f"\n→ Running scraper: {src}")
        _run_scraper(src, state=state, year=year, start_year=start_year, dry_run=dry_run)

    click.echo("\nDone.")


def _run_scraper(source: str, state, year, start_year, dry_run):
    from database import get_session
    from models import ScrapeRun
    from pipeline.normalizer import normalize_bond_measures, normalize_procurement_events
    from pipeline.loader import load_bond_measures, load_procurement_events
    from pipeline.scorer import batch_score_all

    run_record = ScrapeRun(
        scraper_name=source,
        state=state,
        started_at=datetime.utcnow(),
        status="running",
    )

    try:
        raw_records = []

        if source == "cdiac":
            from scrapers.california.cdiac_scraper import scrape_bond_elections, scrape_authorized_unissued
            years = [year] if year else None
            raw_records = scrape_bond_elections(years=years)
            raw_records += scrape_authorized_unissued()

        elif source == "ca_elections":
            from scrapers.california.ca_election_scraper import scrape_local_bond_measures
            end_year = year or None
            raw_records = scrape_local_bond_measures(start_year=start_year, end_year=end_year)

        elif source == "tx_brb":
            from scrapers.texas.tx_brb_scraper import scrape_bond_elections, scrape_authorized_unissued
            end_year = year or None
            raw_records = scrape_bond_elections(start_year=start_year, end_year=end_year)
            raw_records += scrape_authorized_unissued()

        elif source == "ballotpedia":
            from scrapers.ballotpedia.ballotpedia_scraper import scrape_bond_measures
            states = [state] if state else None
            end_year = year or None
            raw_records = scrape_bond_measures(states=states, start_year=start_year, end_year=end_year)

        elif source == "procurement":
            from scrapers.procurement.procurement_scraper import scrape_all_portals
            from pipeline.normalizer import normalize_procurement_events
            states = [state] if state else None
            raw_procs = scrape_all_portals(states=states)
            norm_procs = normalize_procurement_events(raw_procs)
            click.echo(f"  Raw: {len(raw_procs)}  Normalised: {len(norm_procs)}")
            if not dry_run:
                stats = load_procurement_events(norm_procs, scrape_run=run_record)
                click.echo(f"  Loaded — added={stats['added']} updated={stats['updated']} skipped={stats['skipped']}")
                run_record.mark_complete(
                    records_found=len(raw_procs),
                    records_added=stats["added"],
                    records_updated=stats["updated"],
                )
            else:
                for r in norm_procs[:5]:
                    click.echo(f"  [DRY RUN] {r.get('agency_name')} — {r.get('title')[:60]}")
            _save_run(run_record)
            return

        # Bond measure path
        norm_records = normalize_bond_measures(raw_records)
        click.echo(f"  Raw: {len(raw_records)}  Normalised: {len(norm_records)}")

        if dry_run:
            for r in norm_records[:5]:
                click.echo(f"  [DRY RUN] {r.get('name')} ({r.get('state')}) — {r.get('measure_name')} {r.get('election_date')} {'PASSED' if r.get('result') == 'passed' else r.get('result','?').upper()}")
        else:
            stats = load_bond_measures(norm_records, scrape_run=run_record)
            click.echo(f"  Loaded — added={stats['added']} updated={stats['updated']} skipped={stats['skipped']}")
            run_record.mark_complete(
                records_found=len(raw_records),
                records_added=stats["added"],
                records_updated=stats["updated"],
            )

    except Exception as exc:
        logger.exception(f"Scraper '{source}' failed: {exc}")
        run_record.mark_failed(str(exc))
        click.echo(f"  ERROR: {exc}", err=True)

    _save_run(run_record)


def _save_run(run_record):
    from database import get_session
    with get_session() as session:
        session.merge(run_record)


# ---------------------------------------------------------------------------
# score command
# ---------------------------------------------------------------------------

@cli.command()
@click.option("--agency-id", type=int, default=None, help="Score a single agency by ID")
def score(agency_id: Optional[int]):
    """(Re)score agencies and update lead_scores table."""
    from database import init_db
    from pipeline.scorer import score_agency, batch_score_all

    init_db()

    if agency_id:
        result = score_agency(agency_id)
        if result:
            click.echo(f"Agency {agency_id} — score={result['score']} stage={result['opportunity_stage']} approach_now={result['approach_now']}")
        else:
            click.echo(f"Agency {agency_id} not found.", err=True)
    else:
        click.echo("Scoring all agencies…")
        stats = batch_score_all()
        click.echo(f"Done — scored={stats['scored']} errors={stats['errors']}")


# ---------------------------------------------------------------------------
# db command group
# ---------------------------------------------------------------------------

@cli.group()
def db():
    """Database management commands."""
    pass


@db.command("init")
def db_init():
    """Create all database tables."""
    from database import init_db
    init_db()
    click.echo("Database initialised.")


@db.command("dedup")
def db_dedup():
    """Find and merge near-duplicate agency records."""
    from database import get_session, deduplicate_agencies
    with get_session() as session:
        merged = deduplicate_agencies(session)
    click.echo(f"Merged {len(merged)} duplicate agency pairs.")


@db.command("stats")
def db_stats():
    """Print row counts for all tables."""
    from database import get_engine
    from sqlalchemy import text
    engine = get_engine()
    with engine.connect() as conn:
        tables = ["agencies", "bond_measures", "contacts", "consultants",
                  "procurement_events", "source_documents", "lead_scores",
                  "scrape_runs", "outreach_actions"]
        click.echo("\nTable counts:")
        for t in tables:
            try:
                count = conn.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar()
                click.echo(f"  {t:<25} {count:>8}")
            except Exception:
                click.echo(f"  {t:<25} {'N/A':>8}")


if __name__ == "__main__":
    cli()
