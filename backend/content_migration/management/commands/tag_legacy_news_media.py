import json
from dataclasses import asdict

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from content_migration.legacy_news.ai_tags import LegacyNewsAITagger
from core.models import Tenant


class Command(BaseCommand):
    help = "Run the optional cached and cost-capped legacy News image-tagging pilot"

    def add_arguments(self, parser):
        parser.add_argument("--user", required=True)
        parser.add_argument("--tenant", required=True)
        parser.add_argument("--limit", type=int, default=100)
        parser.add_argument("--budget-usd", type=float, default=1.0)
        parser.add_argument("--model", default="gpt-6-luna")

    def handle(self, *args, **options):
        try:
            user = get_user_model().objects.get(username=options["user"])
        except get_user_model().DoesNotExist as exc:
            raise CommandError(f"User not found: {options['user']}") from exc
        try:
            tenant = Tenant.objects.get(identifier=options["tenant"], is_active=True)
        except Tenant.DoesNotExist as exc:
            raise CommandError(f"Active tenant not found: {options['tenant']}") from exc
        if not tenant.user_has_access(user):
            raise CommandError("User is not authorized for the target tenant")
        result = LegacyNewsAITagger(
            tenant=tenant,
            user=user,
            limit=options["limit"],
            budget_usd=options["budget_usd"],
            model=options["model"],
        ).run()
        self.stdout.write(self.style.SUCCESS(json.dumps(asdict(result), sort_keys=True)))
