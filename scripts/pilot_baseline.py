#!/usr/bin/env python3
"""Run the frozen pilot baseline in disposable containers, or compare a future adapter."""

import argparse
import json
import platform
import shutil
import subprocess
import sys
import tempfile
import time
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from webpages.tests.pilot_baseline_adapter import comparable_observations  # noqa: E402

FIXTURES = ROOT / "backend/webpages/tests/fixtures/pilot_baseline"
REQUIRED_BACKEND_SCENARIOS = {
    "webpages.tests.test_pilot_baseline.PilotContractBaselineTests.test_frozen_wire_contracts_and_complete_render_catalog",
    "webpages.tests.test_pilot_baseline.PilotContractBaselineTests.test_independent_scenario_expectations",
    "webpages.tests.test_pilot_baseline.PilotPersistenceBaselineTests.test_save_reload_preserves_pilot_content_order_and_live_snapshot",
    "webpages.tests.test_pilot_baseline.PilotPersistenceBaselineTests.test_stale_save_changes_neither_content_revision_nor_live_and_does_not_broadcast",
    "webpages.tests.test_pilot_baseline.PilotPersistenceBaselineTests.test_other_tenant_and_anonymous_requests_cannot_save_pilot",
    "webpages.tests.test_pilot_baseline.PilotPersistenceBaselineTests.test_authenticated_session_without_csrf_cannot_save_pilot",
}
REQUIRED_CONTRACT_SCENARIOS = {
    "webpages.tests.test_widget_contracts.WidgetContractTests.test_catalog_covers_every_builtin_without_changing_runtime_metadata",
    "webpages.tests.test_widget_contracts.WidgetContractTests.test_node_manifest_matches_python_and_checked_in_bytes",
    "webpages.tests.test_widget_contracts.WidgetContractTests.test_python_contracts_import_with_django_explicitly_blocked",
    "webpages.tests.test_widget_contracts.WidgetContractTests.test_node_model_validation_matches_pydantic_field_matrix",
}
REQUIRED_FRONTEND_SCENARIOS = {
    "portable pilot render baseline preserves all fixture types, headings, child identities and ordering",
    "portable pilot render baseline keeps forms usable and prevents preview submission",
    "portable pilot render baseline does not mutate stored fixture data when preview state changes",
    "portable pilot render baseline omits invisible widgets including their nested children",
    "portable pilot render baseline sanitizes rich banner content without losing safe content",
    "render registry parity covers every editable widget with a renderer and deterministic fixture",
    "render registry parity covers both production layouts",
    "PagePreview iframe keeps the configured viewport and allows vertical scrolling",
    "PagePreview iframe sends unsaved local widgets to the React frame",
    "PagePreview iframe resolves dynamic preview data again when refreshed",
    "PagePreview iframe builds theme CSS locally for the unsaved preview",
}
REQUIRED_BROWSER_SCENARIOS = {
    (project, title)
    for project in ("desktop", "mobile")
    for title in (
        "all four types retain content, ordering, nesting and responsive columns",
        "form controls work while preview submission stays inert",
        "unsaved preview changes do not overwrite the saved fixture",
    )
}


def frontend_passes(result):
    assertions = [assertion for suite in result["testResults"] for assertion in suite["assertionResults"]]
    passed = {assertion["fullName"] for assertion in assertions if assertion["status"] == "passed"}
    return (
        result["success"]
        and REQUIRED_FRONTEND_SCENARIOS <= passed
        and all(assertion["status"] == "passed" for assertion in assertions)
        and not any(result.get(key, 0) for key in ("numFailedTests", "numPendingTests", "numTodoTests"))
    )


def browser_passes(result):
    passed = set()

    def collect(suites):
        for suite in suites:
            for spec in suite.get("specs", []):
                for test in spec.get("tests", []):
                    runs = test.get("results", [])
                    if (
                        test.get("expectedStatus") == "passed"
                        and test.get("status") == "expected"
                        and len(runs) == 1
                        and runs[0].get("status") == "passed"
                    ):
                        passed.add((test["projectName"], spec["title"]))
            collect(suite.get("suites", []))

    collect(result["suites"])
    return REQUIRED_BROWSER_SCENARIOS <= passed and not (
        result.get("errors") or any(result["stats"].get(key, 0) for key in ("unexpected", "skipped", "flaky"))
    )


def backend_passes(result, required=REQUIRED_BACKEND_SCENARIOS):
    passed = {scenario["id"] for scenario in result["scenarios"] if scenario["status"] == "passed"}
    return required <= passed and not any(
        result.get(key, 0) for key in ("failures", "errors", "skipped", "expectedFailures", "unexpectedSuccesses")
    )


def differences(expected, actual, path="$"):
    """Strict JSON comparison: preserve types, missing fields and array order."""
    if type(expected) is not type(actual):
        return [f"{path}: type differs"]
    if isinstance(expected, dict):
        result = [f"{path}.{key}: missing" for key in expected.keys() - actual.keys()]
        result += [f"{path}.{key}: unexpected" for key in actual.keys() - expected.keys()]
        for key in sorted(expected.keys() & actual.keys()):
            result += differences(expected[key], actual[key], f"{path}.{key}")
        return result
    if isinstance(expected, list):
        result = [] if len(expected) == len(actual) else [f"{path}: length differs"]
        for index, (left, right) in enumerate(zip(expected, actual)):
            result += differences(left, right, f"{path}[{index}]")
        return result
    return [] if expected == actual else [f"{path}: value differs"]


def compare(reference, candidate):
    # Keep raw captures intact; only versioned diagnostic documentation is incidental.
    expected = {key: reference[key] for key in ("formatVersion", "casesSha256", "observations")}
    actual = {
        key: candidate.get(key) if isinstance(candidate, dict) else None
        for key in ("formatVersion", "casesSha256", "observations")
    }
    expected["observations"] = comparable_observations(expected["observations"])
    actual["observations"] = comparable_observations(actual["observations"])
    return differences(
        expected,
        actual,
    )


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")


def create_output(directory):
    if directory is None:
        output = Path(tempfile.mkdtemp(prefix="eceee-pilot-baseline-"))
    else:
        output = directory.resolve()
        # Never change permissions or overwrite artifacts in an existing directory.
        output.mkdir(parents=True, exist_ok=False)
    output.chmod(0o777)  # Synthetic test artifacts, writable by container appuser.
    return output


def run(args):
    try:
        output = create_output(args.output)
    except OSError as error:
        print(f"Cannot create a new pilot output directory: {error}", file=sys.stderr)
        return 1
    # Snapshot tracked/new nonignored test sources once. Never mount operator env,
    # credentials, existing node_modules or a changing checkout into the containers.
    source_temp = tempfile.TemporaryDirectory(prefix="eceee-pilot-source-")
    source = Path(source_temp.name)
    names = (
        subprocess.check_output(
            ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z", "backend", "frontend"], cwd=ROOT
        )
        .decode()
        .split("\0")
    )
    for name in names:
        path = Path(name)
        if not name or not (ROOT / path).is_file():
            continue
        if path.name == ".DS_Store":
            (ROOT / path).unlink()
            continue
        if (
            path.name.startswith(".env")
            or any(part in {"venv", ".venv", "node_modules", "__pycache__"} for part in path.parts)
            or name.startswith("frontend/public/")
        ):
            continue
        target = source / path
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / path, target)
    for directory in (source / "backend/logs", source / "frontend/node_modules"):
        directory.mkdir(parents=True, exist_ok=True)
    docker = ["docker", "--context", args.docker_context]
    identity = f"eceee-pilot-{uuid.uuid4().hex[:12]}"
    network, database = identity, f"{identity}-db"
    report = {
        "formatVersion": 1,
        "referenceCommit": json.loads((FIXTURES / "cases.json").read_text())["referenceCommit"],
        "testedCommit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
        "workingTreeDirty": bool(subprocess.check_output(["git", "status", "--porcelain"], cwd=ROOT, text=True)),
        "candidateParity": "not_supplied",
        "knownReferenceIssues": json.loads((FIXTURES / "cases.json").read_text()).get("knownReferenceIssues", []),
        "runnerPython": platform.python_version(),
        "status": "running",
        "phases": [],
    }
    print(f"Pilot artifacts: {output}", flush=True)

    def phase(name, command, timeout=600):
        started = time.monotonic()
        with (output / f"{name}.log").open("w") as log:
            process = subprocess.run(command, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, timeout=timeout)
        report["phases"].append(
            {
                "name": name,
                "command": command,
                "exitCode": process.returncode,
                "seconds": round(time.monotonic() - started, 2),
            }
        )
        print(f"{name}: {'passed' if process.returncode == 0 else 'FAILED'}", flush=True)
        if process.returncode:
            raise RuntimeError(f"{name} failed; see {output / (name + '.log')}")

    backend = docker + [
        "run",
        "--rm",
        "--name",
        f"{identity}-backend",
        "--network",
        network,
        "--mount",
        f"type=bind,source={source / 'backend'},target=/app,readonly",
        "--mount",
        f"type=bind,source={source / 'frontend'},target=/frontend,readonly",
        "--mount",
        f"type=bind,source={output},target=/pilot-output",
        "--tmpfs",
        "/app/logs:mode=1777",
        "--entrypoint",
        "python",
        "-e",
        "DJANGO_SETTINGS_MODULE=config.settings_pilot_baseline",
        "-e",
        "DJANGO_TESTING=1",
        "-e",
        "DJANGO_TEST_DATABASE=postgres",
        "-e",
        "DEBUG=False",
        "-e",
        "SECRET_KEY=public-disposable-pilot-fixture-key-not-an-operator-credential",
        "-e",
        "PILOT_BACKEND_REPORT=/pilot-output/backend.json",
        args.backend_image,
    ]
    try:
        if args.candidate_contracts:
            phase(
                "node-contracts",
                docker
                + [
                    "run",
                    "--rm",
                    "--name",
                    f"{identity}-contracts",
                    "--network",
                    "none",
                    "--mount",
                    f"type=bind,source={source / 'backend/widget_contracts'},target=/contracts,readonly",
                    "--mount",
                    f"type=bind,source={source / 'backend/webpages/tests/fixtures/pilot_baseline'},target=/fixtures,readonly",
                    "--mount",
                    f"type=bind,source={output},target=/pilot-output",
                    "--entrypoint",
                    "sh",
                    args.contract_image,
                    "-euc",
                    "node --test /contracts/tests/*.test.mjs\n"
                    "node /contracts/observe.mjs /fixtures/cases.json /pilot-output/node-observed.json",
                ],
            )
            candidate = json.loads((output / "node-observed.json").read_text())
            mismatch = compare(json.loads((FIXTURES / "reference.json").read_text()), candidate)
            report["contractCandidate"] = {
                "status": "failed" if mismatch else "passed",
                "differences": mismatch,
                "runtime": candidate["candidateRuntime"],
                "observationCount": len(candidate["observations"]),
                "scope": "metadata-and-validation-comparison-only",
            }
            write_json(output / "node-comparison.json", report["contractCandidate"])
            if mismatch:
                raise RuntimeError("Node contract candidate mismatch; see node-comparison.json")
        if not args.frontend_only:
            subprocess.run(
                docker + ["network", "create", "--label", "eceee.purpose=pilot-baseline", network],
                check=True,
                stdout=subprocess.DEVNULL,
            )
            subprocess.run(
                docker
                + [
                    "run",
                    "--rm",
                    "-d",
                    "--name",
                    database,
                    "--network",
                    network,
                    "--network-alias",
                    "pilot-db",
                    "--tmpfs",
                    "/var/lib/postgresql/data",
                    "-e",
                    "POSTGRES_DB=eceee_pilot_reference",
                    "-e",
                    "POSTGRES_HOST_AUTH_METHOD=trust",
                    "postgres:17-alpine",
                ],
                check=True,
                stdout=subprocess.DEVNULL,
            )
            for _ in range(40):
                ready = subprocess.run(
                    docker + ["exec", database, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                if ready.returncode == 0:
                    break
                time.sleep(0.5)
            else:
                raise RuntimeError("Disposable PostgreSQL did not become ready")
            report["postgresVersion"] = subprocess.check_output(
                docker
                + [
                    "exec",
                    database,
                    "psql",
                    "-h",
                    "127.0.0.1",
                    "-U",
                    "postgres",
                    "-d",
                    "eceee_pilot_reference",
                    "-Atc",
                    "SHOW server_version",
                ],
                text=True,
            ).strip()
            phase(
                "backend-runtime",
                backend
                + [
                    "-c",
                    (
                        "import json,sys,django,pydantic; from pathlib import Path; "
                        "Path('/pilot-output/backend-runtime.json').write_text(json.dumps({"
                        "'python':sys.version.split()[0],'django':django.get_version(),'pydantic':pydantic.__version__}))"
                    ),
                ],
            )
            report["backendRuntime"] = json.loads((output / "backend-runtime.json").read_text())
            phase(
                "observe-contracts",
                backend
                + [
                    "-m",
                    "webpages.tests.pilot_baseline_adapter",
                    "/pilot-output/observed.json",
                ],
            )
            if args.observe_only:
                report["status"] = "observed_only"
                return 0
            reference = json.loads((FIXTURES / "reference.json").read_text())
            actual = json.loads((output / "observed.json").read_text())
            mismatch = compare(reference, actual)
            write_json(
                output / "contracts.json",
                {
                    "status": "failed" if mismatch else "passed",
                    "differences": mismatch,
                    "scenarios": sorted(actual["observations"]),
                },
            )
            if mismatch:
                raise RuntimeError("Frozen contract mismatch; see contracts.json")
            phase(
                "backend-tests",
                backend
                + [
                    "manage.py",
                    "test",
                    "webpages.tests.test_pilot_baseline",
                    *(
                        [
                            "webpages.tests.test_widget_contracts",
                            "easy_widgets.tests",
                            "webpages.tests.test_publisher_manifest",
                            "webpages.tests.test_theme_layouts",
                            "webpages.tests.test_error_pages",
                        ]
                        if args.candidate_contracts
                        else []
                    ),
                    "--keepdb",
                    "--noinput",
                    "--verbosity=2",
                    "--testrunner=webpages.tests.pilot_baseline_runner.PilotRunner",
                ],
            )
            backend_result = json.loads((output / "backend.json").read_text())
            required = REQUIRED_BACKEND_SCENARIOS | (REQUIRED_CONTRACT_SCENARIOS if args.candidate_contracts else set())
            if not backend_passes(backend_result, required):
                raise RuntimeError("Missing or skipped mandatory backend scenarios")
            report["backend"] = backend_result
        if not args.backend_only:
            phase(
                "frontend-tests",
                docker
                + [
                    "run",
                    "--rm",
                    "--name",
                    f"{identity}-frontend",
                    "--mount",
                    f"type=bind,source={source},target=/workspace,readonly",
                    "--mount",
                    f"type=bind,source={output},target=/pilot-output",
                    "--tmpfs",
                    "/workspace/frontend/node_modules:exec,size=2g",
                    "-w",
                    "/workspace/frontend",
                    "-e",
                    "CI=1",
                    "-e",
                    "PILOT_BROWSER_PORT=3000",
                    "-e",
                    "PILOT_BROWSER_REPORT=/pilot-output/browser.json",
                    "-e",
                    "PILOT_BROWSER_ARTIFACTS=/pilot-output/browser-artifacts",
                    args.browser_image,
                    "bash",
                    "-euc",
                    "npm ci --ignore-scripts --no-audit --no-fund\n"
                    "node -e \"require('fs').writeFileSync('/pilot-output/frontend-runtime.json', JSON.stringify({"
                    "node:process.version,react:require('react/package.json').version,"
                    "playwright:require('@playwright/test/package.json').version,vitest:require('vitest/package.json').version}))\"\n"
                    "npx eslint e2e/pilot-baseline.spec.js playwright.pilot.config.js vite.pilot.config.js\n"
                    "npm run test:run -- src/rendering/__tests__/pilotBaseline.test.tsx "
                    "src/rendering/__tests__/registryParity.test.ts src/components/__tests__/PagePreview.iframe.test.jsx "
                    "--maxWorkers=2 --reporter=json --outputFile=/pilot-output/frontend.json\n"
                    "npx playwright test --config playwright.pilot.config.js",
                ],
            )
            frontend_result = json.loads((output / "frontend.json").read_text())
            browser_result = json.loads((output / "browser.json").read_text())
            if not frontend_passes(frontend_result) or not browser_passes(browser_result):
                raise RuntimeError("Missing, failed, skipped or flaky mandatory frontend scenarios")
            report["frontend"] = {
                key: frontend_result[key] for key in ("numPassedTests", "numFailedTests", "numPendingTests")
            }
            report["browser"] = browser_result["stats"]
            report["frontendRuntime"] = json.loads((output / "frontend-runtime.json").read_text())
        report["status"] = "passed" if not (args.backend_only or args.frontend_only) else "partial_passed"
        if report["status"] == "passed" and report["knownReferenceIssues"]:
            report["status"] = "passed_with_known_reference_issues"
        return 0
    except (RuntimeError, subprocess.SubprocessError, OSError, ValueError, KeyError) as error:
        report["status"] = "failed"
        report["error"] = str(error)
        print(str(error), file=sys.stderr)
        return 1
    finally:
        for container in (f"{identity}-backend", f"{identity}-frontend", f"{identity}-contracts", database):
            subprocess.run(docker + ["rm", "-f", container], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        subprocess.run(docker + ["network", "rm", network], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        write_json(output / "report.json", report)
        source_temp.cleanup()
        print(f"Result: {report['status']}; candidate parity: not supplied", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    compare_parser = commands.add_parser(
        "compare", help="Compare observations from a future adapter to the frozen reference"
    )
    compare_parser.add_argument("candidate", type=Path)
    compare_parser.add_argument("--reference", type=Path, default=FIXTURES / "reference.json")
    compare_parser.add_argument("--output", type=Path, required=True)
    run_parser = commands.add_parser("run")
    run_parser.add_argument("--output", type=Path)
    run_parser.add_argument("--docker-context", default="orbstack")
    run_parser.add_argument("--backend-image", default="eceee-v4-2-backend:latest")
    run_parser.add_argument("--browser-image", default="mcr.microsoft.com/playwright:v1.60.0-noble")
    run_parser.add_argument(
        "--candidate-contracts", action="store_true", help="Compare the standalone Node widget pilot"
    )
    run_parser.add_argument("--contract-image", default="node:22-alpine")
    scope = run_parser.add_mutually_exclusive_group()
    scope.add_argument("--backend-only", action="store_true")
    scope.add_argument("--frontend-only", action="store_true")
    scope.add_argument(
        "--observe-only", action="store_true", help="Capture for manual review; never overwrites the reference"
    )
    args = parser.parse_args()
    if args.command == "run":
        return run(args)
    mismatch = compare(json.loads(args.reference.read_text()), json.loads(args.candidate.read_text()))
    write_json(args.output, {"status": "failed" if mismatch else "passed", "differences": mismatch})
    print(f"Candidate comparison: {'failed' if mismatch else 'passed'} ({len(mismatch)} differences)")
    return int(bool(mismatch))


if __name__ == "__main__":
    sys.exit(main())
