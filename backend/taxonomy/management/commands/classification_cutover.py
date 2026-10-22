import json

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from content.models import Namespace
from taxonomy.rollout import activate, reconciliation_report


class Command(BaseCommand):
    help = "Report classification readiness; activate only with --activate and a completed reconciliation run."

    def add_arguments(self, parser):
        parser.add_argument("--namespace", type=int, required=True)
        parser.add_argument("--activate", action="store_true")
        parser.add_argument("--actor", type=int)
        parser.add_argument("--run-id")
        parser.add_argument("--report", help="Save the JSON report to a local file.")

    def handle(self, *args, **options):
        namespace = Namespace.objects.select_related("tenant").get(pk=options["namespace"])
        if options["activate"]:
            if not options["actor"] or not options["run_id"]:
                raise CommandError("Activation requires --actor and --run-id.")
            report = activate(namespace, get_user_model().objects.get(pk=options["actor"]), options["run_id"])
        else:
            report = reconciliation_report(namespace)
        payload = json.dumps(report, ensure_ascii=False, indent=2)
        if options["report"]:
            from pathlib import Path

            Path(options["report"]).write_text(payload + "\n")
        self.stdout.write(payload)
        if not report["ready"]:
            raise CommandError("Cutover blocked. Classify the reported media or repair projections before activation.")
