"""Shared paths and SUMO setup, so no script has to repeat them."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SUMO_DIR = ROOT / "sumo"
NET_FILE = str(SUMO_DIR / "intersection.net.xml")
ROUTE_FILE = str(SUMO_DIR / "traffic.rou.xml")
SUMO_CONFIG = str(SUMO_DIR / "sumo.sumocfg")
VIEW_SETTINGS = str(SUMO_DIR / "view.settings.xml")
MODEL_PATH = str(ROOT / "models" / "flowstate_ppo_model")  # SB3 appends .zip

_WINDOWS_SUMO_BINS = (
    r"C:\Program Files (x86)\Eclipse\Sumo\bin",
    r"C:\Program Files\Eclipse\Sumo\bin",
)


def ensure_sumo_on_path():
    """Add a default Windows SUMO install to PATH / SUMO_HOME if it isn't already set up."""
    for path in _WINDOWS_SUMO_BINS:
        if os.path.exists(path):
            if path not in os.environ["PATH"]:
                os.environ["PATH"] += os.pathsep + path
            os.environ.setdefault("SUMO_HOME", os.path.dirname(path))
            return True
    return False


ensure_sumo_on_path()
