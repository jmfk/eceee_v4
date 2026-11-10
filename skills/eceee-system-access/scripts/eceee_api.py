#!/usr/bin/env python3
"""Compatibility entry point; the canonical client lives in eceee-api-operations."""
from pathlib import Path
import runpy

_client = runpy.run_path(str(Path(__file__).resolve().parents[2] / "eceee-api-operations/scripts/eceee_api.py"))
globals().update({name: value for name, value in _client.items() if not name.startswith("__")})

if __name__ == "__main__":
    raise SystemExit(main())
