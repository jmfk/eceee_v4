#!/usr/bin/env python3
"""Validate the reviewed site-2 inventory and emit portable preparation/import files."""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from content_migration.legacy_content import term_plan  # noqa: E402

compile_plan = term_plan.compile_plan
digest = term_plan.digest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, help="Write the portable definition and term bundle")
    parser.add_argument("--mapping", type=Path, help="Write the portable reviewed import map")
    parser.add_argument("--review", type=Path, help="Write the complete source-to-target review table")
    args = parser.parse_args()
    result = compile_plan()
    for key in ("bundle", "mapping", "review"):
        path = getattr(args, key)
        if path:
            path.write_text(
                json.dumps(result["reviewRows" if key == "review" else key], ensure_ascii=False, indent=2) + "\n"
            )
    print(
        json.dumps(
            {
                "sourceTerms": len(result["mapping"]["termRefs"]),
                "targetTerms": len(result["bundle"]["terms"]),
                "bundleDigest": digest(result["bundle"]),
                "mappingDigest": digest(result["mapping"]),
            }
        )
    )


if __name__ == "__main__":
    main()
