"""Machine-readable results; skipped tests fail the pilot gate."""

import json
import os
from pathlib import Path
from unittest import TextTestResult, TextTestRunner

from django.test.runner import DiscoverRunner


class PilotResult(TextTestResult):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.scenarios = []

    def addSuccess(self, test):
        super().addSuccess(test)
        self.scenarios.append({"id": test.id(), "status": "passed"})

    def addFailure(self, test, err):
        super().addFailure(test, err)
        self.scenarios.append({"id": test.id(), "status": "failed"})

    def addError(self, test, err):
        super().addError(test, err)
        self.scenarios.append({"id": test.id(), "status": "error"})

    def addSkip(self, test, reason):
        super().addSkip(test, reason)
        self.scenarios.append({"id": test.id(), "status": "skipped", "reason": reason})


class PilotTextRunner(TextTestRunner):
    resultclass = PilotResult


class PilotRunner(DiscoverRunner):
    test_runner = PilotTextRunner

    def run_suite(self, suite, **kwargs):
        result = super().run_suite(suite, **kwargs)
        output = os.environ.get("PILOT_BACKEND_REPORT")
        if output:
            Path(output).write_text(
                json.dumps(
                    {
                        "testsRun": result.testsRun,
                        "failures": len(result.failures),
                        "errors": len(result.errors),
                        "skipped": len(result.skipped),
                        "expectedFailures": len(result.expectedFailures),
                        "unexpectedSuccesses": len(result.unexpectedSuccesses),
                        "scenarios": result.scenarios,
                    },
                    indent=2,
                )
                + "\n"
            )
        return result

    def suite_result(self, suite, result, **kwargs):
        return super().suite_result(suite, result, **kwargs) + len(result.skipped) + len(result.expectedFailures)
