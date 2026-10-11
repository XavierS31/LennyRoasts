"""Load the committed offline configuration and resolve local artifact paths."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG_DIR = ROOT / "offline" / "config"
LOCAL_DIR = ROOT / ".local-tests" / "offline"
SEEDS_DIR = LOCAL_DIR / "seeds"

SPONSOR_IDS = ["gemini", "elevenlabs", "databricks", "bny"]
GENERAL_IDS = ["overall", "best_ai", "best_game", "most_useful"]
GENERAL_POOL = "general"


def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def challenges():
    """Challenge definitions keyed by id, in contract order."""
    return {c["id"]: c for c in load_json(CONFIG_DIR / "kh9_challenges.json")["challenges"]}


def settings():
    return load_json(CONFIG_DIR / "field_settings.json")


def seed_manifest():
    return load_json(CONFIG_DIR / "seed_manifest.json")["seeds"]


def field_dir(field_id):
    return LOCAL_DIR / "fields" / field_id


def require_local(path):
    """Refuse to write story-derived data outside the Git-ignored .local-tests tree."""
    path = Path(path).resolve()
    if not path.is_relative_to(ROOT / ".local-tests"):
        raise SystemExit(f"Refusing to write outside .local-tests/: {path}")
    return path
