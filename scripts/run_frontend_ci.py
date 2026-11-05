"""Run Vitest's dependency-aware changed tests, falling back when none are found."""

import argparse
import json
import subprocess
import tempfile
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", required=True)
    parser.add_argument("--full", action="store_true")
    args = parser.parse_args()
    frontend = Path(__file__).resolve().parents[1] / "frontend"
    vitest = str(frontend / "node_modules/.bin/vitest")
    changed = []
    if not args.full:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "tests.json"
            subprocess.run(
                [vitest, "list", "--changed", args.base, "--filesOnly", "--json", str(output)],
                cwd=frontend,
                check=True,
            )
            selected = json.loads(output.read_text())
            if not isinstance(selected, list):
                raise ValueError("Unexpected Vitest selection")
            if selected:
                changed = ["--changed", args.base]
            else:
                print("No related tests found; running the frontend suite instead", flush=True)
    subprocess.run([vitest, "run", *changed, "--bail=1", "--maxWorkers=2"], cwd=frontend, check=True)


if __name__ == "__main__":
    main()
