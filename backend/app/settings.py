"""Server-only local environment loading. Never print values."""
import os
from dotenv import load_dotenv
from .contracts import ROOT


def load_environment():
    load_dotenv(ROOT / '.env.local', override=False)


def credential_presence():
    load_environment()
    return {key: bool(os.getenv(key)) for key in ('HF_TOKEN', 'DATABASE_URL', 'DATABASE_URL_DIRECT')}
