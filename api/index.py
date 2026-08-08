import sys
from pathlib import Path

# Vercel's FastAPI runtime requires the app entrypoint at api/index.py
# (or the project root). Re-export the real app from the backend package.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from main import app  # noqa: E402,F401
