#!/usr/bin/env bash
# Exercise the runner without Docker, credentials, production, or application data.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_ROOT="$(mktemp -d)"
export TEST_ROOT
trap 'rm -rf "$TEST_ROOT"' EXIT
cp "$SCRIPT_DIR/../reconcile-classifications.sh" "$TEST_ROOT/runner.sh"
touch "$TEST_ROOT/fixture.env"
cat > "$TEST_ROOT/env.sh" <<'FIXTURE'
DEPLOY_DIR="$TEST_ROOT"
REPO="$TEST_ROOT"
ENV_FILE="$TEST_ROOT/fixture.env"
acquire_production_operation_lock() { echo "lock $*" >> "$TEST_ROOT/events"; }
docker_compose() {
    echo "compose $*" >> "$TEST_ROOT/events"
    case "$1" in
        exec) echo release-fixture ;;
        ps) echo "${@: -1}" ;;
        run)
            if [[ "$*" == *--stop-after* && "${FAIL_CANARY:-0}" == 1 ]]; then return 3; fi
            ;;
    esac
}
FIXTURE
cat > "$TEST_ROOT/backup.sh" <<'FIXTURE'
echo backup >> "$TEST_ROOT/events"
if [ "${FAIL_BACKUP:-0}" = 1 ]; then exit 4; fi
FIXTURE
cat > "$TEST_ROOT/healthcheck.sh" <<'FIXTURE'
echo health >> "$TEST_ROOT/events"
FIXTURE
for scenario in success canary-failure backup-failure; do
    : > "$TEST_ROOT/events"
    export FAIL_CANARY=0 FAIL_BACKUP=0
    if [ "$scenario" = canary-failure ]; then export FAIL_CANARY=1; fi
    if [ "$scenario" = backup-failure ]; then export FAIL_BACKUP=1; fi
    if bash "$TEST_ROOT/runner.sh" fixture-run 3 > "$TEST_ROOT/output" 2>&1; then
        [ "$scenario" = success ] || { echo "Unexpected success: $scenario" >&2; exit 1; }
    else
        [ "$scenario" != success ] || { echo "Runner failed" >&2; exit 1; }
    fi
    python3 - "$scenario" <<'PY'
import os, sys
from pathlib import Path
scenario = sys.argv[1]
events = (Path(os.environ['TEST_ROOT']) / 'events').read_text().splitlines()
assert events.index('lock classifications') < events.index('compose stop backend celery-worker celery-beat') < events.index('backup')
assert 'compose up -d backend celery-worker celery-beat' in events
assert 'health' in events
assert not any('classification_cutover' in event or '--activate' in event for event in events)
reconciliation = [event for event in events if 'manage.py reconcile_classifications' in event]
if scenario == 'backup-failure':
    assert not reconciliation
else:
    assert events.index('backup') < events.index(reconciliation[0])
    assert reconciliation[0].endswith('reconcile_classifications --preflight-only')
    assert reconciliation[1].endswith('reconcile_classifications --run-id fixture-run --stop-after 3')
    if scenario == 'success':
        assert reconciliation[2].endswith('reconcile_classifications --run-id fixture-run')
        assert reconciliation[3].endswith('reconcile_classifications --run-id fixture-run --verify-only')
    else:
        assert len(reconciliation) == 2
PY
done
echo 'Classification runner: success, interrupted canary and failed backup passed.'
