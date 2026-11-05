"""Report actual test execution time, including setup and teardown, on Django 4.2."""

import time
import unittest

from django.test.runner import DiscoverRunner


class TimingTestResult(unittest.TextTestResult):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.timings = []

    def startTest(self, test):
        self.started_at = time.perf_counter()
        super().startTest(test)

    def stopTest(self, test):
        self.timings.append((time.perf_counter() - self.started_at, test.id()))
        super().stopTest(test)


class TimingTextTestRunner(unittest.TextTestRunner):
    resultclass = TimingTestResult

    def run(self, test):
        result = super().run(test)
        self.stream.writeln("Slowest tests (includes setup and teardown):")
        for seconds, name in sorted(result.timings, reverse=True)[:20]:
            self.stream.writeln(f"{seconds:.3f}s {name}")
        return result


class TimingDiscoverRunner(DiscoverRunner):
    test_runner = TimingTextTestRunner
