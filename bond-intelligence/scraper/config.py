"""
Bond Intelligence Scraper — configuration
Loads settings from environment / .env file.
"""

import os
from enum import Enum
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Agency type taxonomy
# ---------------------------------------------------------------------------

class AgencyType(str, Enum):
    K12_DISTRICT       = "k12_district"
    COMMUNITY_COLLEGE  = "community_college"
    CITY               = "city"
    COUNTY             = "county"
    SPECIAL_DISTRICT   = "special_district"
    STATE_AGENCY       = "state_agency"
    TRANSIT            = "transit"
    WATER              = "water"
    OTHER              = "other"


AGENCY_TYPES = [e.value for e in AgencyType]

# ---------------------------------------------------------------------------
# Core settings
# ---------------------------------------------------------------------------

DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./bond_intelligence.db")

REQUEST_DELAY: float = float(os.getenv("REQUEST_DELAY", "2.0"))
MAX_RETRIES: int     = int(os.getenv("MAX_RETRIES", "3"))

USER_AGENT: str = (
    "BondIntelligenceScraper/1.0 "
    "(Transcend PM research tool; contact: jim.burlew@jbca-inc.com)"
)

LOG_DIR:  str = os.getenv("LOG_DIR",  "./logs")
DATA_DIR: str = os.getenv("DATA_DIR", "./data")

# Ensure directories exist at import time
Path(LOG_DIR).mkdir(parents=True, exist_ok=True)
Path(DATA_DIR).mkdir(parents=True, exist_ok=True)
Path(DATA_DIR, "raw", "california").mkdir(parents=True, exist_ok=True)
Path(DATA_DIR, "raw", "texas").mkdir(parents=True, exist_ok=True)
Path(DATA_DIR, "raw", "procurement").mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Target states
# ---------------------------------------------------------------------------

TARGET_STATES = ["CA", "TX", "FL", "AZ", "OR", "WA", "CO", "MI", "NY"]

# ---------------------------------------------------------------------------
# Source base URLs
# ---------------------------------------------------------------------------

CA_CDIAC_BASE_URL      = "https://www.treasurer.ca.gov/cdiac/"
CA_DEBTWATCH_BASE_URL  = "https://debtwatch.treasurer.ca.gov/"
CA_SOS_BASE_URL        = "https://www.sos.ca.gov/"
TX_BRB_BASE_URL        = "https://www.brb.texas.gov/"
BALLOTPEDIA_BASE_URL   = "https://ballotpedia.org/"

# Procurement portals
PROCUREMENT_SOURCES = {
    "CA": [
        "https://caleprocure.ca.gov/",
        "https://www.publicpurchase.com/",
    ],
    "TX": [
        "https://www.txsmartbuy.com/",
        "https://esbd.hhs.texas.gov/",
    ],
    "GENERAL": [
        "https://www.planetbids.com/",
        "https://www.bidnetdirect.com/",
    ],
}

# ---------------------------------------------------------------------------
# Procurement keyword taxonomy
# ---------------------------------------------------------------------------

PROCUREMENT_KEYWORDS = [
    "program management",
    "construction management",
    "inspector of record",
    "materials testing",
    "geotechnical",
    "safety plan",
    "PMIS",
    "owner representative",
    "bond program",
    "facilities master plan",
    "DSA",
]

# ---------------------------------------------------------------------------
# Project category taxonomy (used by normalizer)
# ---------------------------------------------------------------------------

PROJECT_CATEGORIES = [
    "new_construction",
    "modernization",
    "safety_security",
    "technology",
    "athletics",
    "early_childhood",
    "stem_facilities",
    "transportation",
    "water_infrastructure",
    "energy_efficiency",
    "seismic_retrofit",
    "deferred_maintenance",
]
