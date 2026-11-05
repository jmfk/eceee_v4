"""A tagged deploy cannot reach environment/runtime mutation before CI verification."""

import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class DeployTargetTests(unittest.TestCase):
    def execute(self, proof_status=0, tag="v1.0.0", extra=()):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            env = {**os.environ, "GIT_CONFIG_GLOBAL": os.devnull, "GIT_CONFIG_SYSTEM": os.devnull}
            for path in ("make", "scripts", "deploy/scripts"):
                (root / path).mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / "make/production.mk", root / "make/production.mk")
            (root / "deploy/scripts/resolve-deploy-ref.sh").write_text("git rev-parse HEAD\n")
            (root / "deploy/scripts/setup-env.sh").write_text("echo mutation >> order\n")
            (root / "scripts/ci_evidence.py").write_text(
                f"from pathlib import Path\np=Path('order')\np.write_text('ci\\n')\nraise SystemExit({proof_status})\n"
            )
            for args in (
                ("init", "-q"),
                ("config", "user.email", "ci@example.com"),
                ("config", "user.name", "CI"),
                ("add", "."),
                ("commit", "-qm", "fixture"),
                ("tag", "v1.0.0"),
            ):
                subprocess.run(["git", *args], cwd=root, env=env, capture_output=True, check=True)
            result = subprocess.run(
                ["make", "-f", "make/production.mk", "prod-deploy", f"TAG={tag}", *extra],
                cwd=root,
                env=env,
                capture_output=True,
                text=True,
            )
            order = (root / "order").read_text().splitlines() if (root / "order").exists() else []
            return result.returncode, order

    def test_failed_proof_prevents_mutation(self):
        status, order = self.execute(proof_status=1)
        self.assertNotEqual(status, 0)
        self.assertEqual(order, ["ci"])

    def test_verified_tag_preserves_normal_mutation_path(self):
        self.assertEqual(self.execute(), (0, ["ci", "mutation"]))

    def test_missing_or_non_tag_release_and_retired_fast_path_are_rejected(self):
        for tag, extra in (("", ()), ("main", ()), ("v1.0.0", ("FAST_RELEASE=1",))):
            with self.subTest(tag=tag, extra=extra):
                status, order = self.execute(tag=tag, extra=extra)
                self.assertNotEqual(status, 0)
                self.assertEqual(order, [])


if __name__ == "__main__":
    unittest.main()
