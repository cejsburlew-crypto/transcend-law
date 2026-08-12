"""
Bond Intelligence Scraper — APScheduler daemon.

Runs scraper jobs on a cron schedule and re-scores after each run.

Start with:
  python scheduler.py

Stop with Ctrl-C. Logs to logs/scheduler.log.
"""

from __future__ import annotations

import sys
import signal
from datetime import datetime

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
from dotenv import load_dotenv
from loguru import logger

load_dotenv()

logger.remove()
logger.add(sys.stderr, level="INFO", format="<green>{time:HH:mm:ss}</green> | <level>{level}</level> | {message}")
logger.add("logs/scheduler_{time:YYYY-MM-DD}.log", level="DEBUG", rotation="1 day", retention="30 days")

scheduler = BlockingScheduler(timezone="America/Los_Angeles")


# ---------------------------------------------------------------------------
# Job wrappers
# ---------------------------------------------------------------------------

def job_cdiac():
    logger.info("SCHEDULER: Starting CDIAC scrape job")
    try:
        from main import _run_scraper
        _run_scraper("cdiac", state=None, year=None, start_year=2020, dry_run=False)
        _run_rescore()
    except Exception as exc:
        logger.error(f"SCHEDULER: CDIAC job failed: {exc}")


def job_ca_elections():
    logger.info("SCHEDULER: Starting CA Elections scrape job")
    try:
        from main import _run_scraper
        _run_scraper("ca_elections", state=None, year=None, start_year=2020, dry_run=False)
        _run_rescore()
    except Exception as exc:
        logger.error(f"SCHEDULER: CA Elections job failed: {exc}")


def job_tx_brb():
    logger.info("SCHEDULER: Starting TX BRB scrape job")
    try:
        from main import _run_scraper
        _run_scraper("tx_brb", state=None, year=None, start_year=2020, dry_run=False)
        _run_rescore()
    except Exception as exc:
        logger.error(f"SCHEDULER: TX BRB job failed: {exc}")


def job_ballotpedia():
    logger.info("SCHEDULER: Starting Ballotpedia scrape job")
    try:
        from main import _run_scraper
        _run_scraper("ballotpedia", state=None, year=None, start_year=2020, dry_run=False)
        _run_rescore()
    except Exception as exc:
        logger.error(f"SCHEDULER: Ballotpedia job failed: {exc}")


def job_procurement():
    logger.info("SCHEDULER: Starting Procurement scrape job")
    try:
        from main import _run_scraper
        _run_scraper("procurement", state=None, year=None, start_year=2020, dry_run=False)
        _run_rescore()
    except Exception as exc:
        logger.error(f"SCHEDULER: Procurement job failed: {exc}")


def _run_rescore():
    logger.info("SCHEDULER: Running batch re-score after scrape")
    try:
        from pipeline.scorer import batch_score_all
        stats = batch_score_all()
        logger.info(f"SCHEDULER: Re-score complete — {stats}")
    except Exception as exc:
        logger.error(f"SCHEDULER: Re-score failed: {exc}")


# ---------------------------------------------------------------------------
# Schedule definitions
# ---------------------------------------------------------------------------

def register_jobs():
    # CDIAC — every Monday at 02:00 PT
    scheduler.add_job(
        job_cdiac,
        CronTrigger(day_of_week="mon", hour=2, minute=0),
        id="cdiac",
        name="CDIAC DebtWatch scrape",
        replace_existing=True,
    )

    # CA Elections — every Monday at 02:30 PT
    scheduler.add_job(
        job_ca_elections,
        CronTrigger(day_of_week="mon", hour=2, minute=30),
        id="ca_elections",
        name="CA SOS elections scrape",
        replace_existing=True,
    )

    # TX BRB — every Monday at 03:00 PT
    scheduler.add_job(
        job_tx_brb,
        CronTrigger(day_of_week="mon", hour=3, minute=0),
        id="tx_brb",
        name="TX BRB scrape",
        replace_existing=True,
    )

    # Ballotpedia — every Monday at 04:00 PT
    scheduler.add_job(
        job_ballotpedia,
        CronTrigger(day_of_week="mon", hour=4, minute=0),
        id="ballotpedia",
        name="Ballotpedia bond measures scrape",
        replace_existing=True,
    )

    # Procurement — every day at 01:00 PT (most time-sensitive)
    scheduler.add_job(
        job_procurement,
        CronTrigger(hour=1, minute=0),
        id="procurement",
        name="Procurement portals daily scrape",
        replace_existing=True,
    )

    logger.info("SCHEDULER: All jobs registered")
    for job in scheduler.get_jobs():
        logger.info(f"  {job.name}: next run = {job.next_run_time}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    from database import init_db
    init_db()

    register_jobs()

    def _shutdown(signum, frame):
        logger.info("SCHEDULER: Received shutdown signal, stopping…")
        scheduler.shutdown(wait=False)
        sys.exit(0)

    signal.signal(signal.SIGINT,  _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    logger.info("SCHEDULER: Starting — press Ctrl-C to stop")
    scheduler.start()


if __name__ == "__main__":
    main()
