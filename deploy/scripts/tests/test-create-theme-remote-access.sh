#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUBJECT="$SCRIPT_DIR/../create-theme-remote-access.sh"

python3 - "$SUBJECT" <<'PY'
import re
import sys
from pathlib import Path

source = Path(sys.argv[1]).read_text()
remote_script = source.split("<<'REMOTE_SCRIPT'\n", 1)[1].rsplit("\nREMOTE_SCRIPT", 1)[0]

commands = re.findall(r'"\$\{compose\[@\]\}" exec -T backend python manage\.py [\s\S]*?</dev/null', remote_script)
if len(commands) != 2:
    raise SystemExit("Every remote docker compose exec must detach stdin from the SSH here-document.")

if "setup_theme_remote_access" not in commands[1]:
    raise SystemExit("The key creation command is not protected from consuming SSH script input.")
PY

echo "theme remote access stdin regression test passed"
