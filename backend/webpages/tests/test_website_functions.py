from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework.exceptions import ValidationError
from core.models import Tenant, TenantRole
from webpages.models import PagePathAlias, PageVersion, PublicFormSubmission, WebPage
from webpages.views.submission_views import SubmissionView
from webpages.website_settings import validate_website_settings


class WebsiteFunctionsTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="editor", password="test-only")
        self.tenant = Tenant.objects.create(name="Website tests", identifier="website-tests", created_by=self.user)
        self.root = WebPage.objects.create(
            created_by=self.user, last_modified_by=self.user, tenant=self.tenant, title="Root", slug="root"
        )
        self.page = WebPage.objects.create(
            created_by=self.user,
            last_modified_by=self.user,
            tenant=self.tenant,
            parent=self.root,
            title="Contact",
            slug="contact",
        )
        self.version = PageVersion.objects.create(
            page=self.page, version_number=1, created_by=self.user, effective_date=timezone.now()
        )
        self.factory = APIRequestFactory()

    def call(self, method="get", data=None, user=None, pk=None):
        request = getattr(self.factory, method)("/api/v1/webpages/pages/submissions/", data or {}, format="json")
        request.tenant = self.tenant
        force_authenticate(request, user=user or self.user)
        return SubmissionView.as_view()(request, **({"pk": pk} if pk else {}))

    def test_path_changes_keep_aliases_to_stable_page_and_descendants(self):
        child = WebPage.objects.create(
            created_by=self.user,
            last_modified_by=self.user,
            tenant=self.tenant,
            parent=self.page,
            title="Child",
            slug="child",
        )
        PageVersion.objects.create(page=child, version_number=1, created_by=self.user, effective_date=timezone.now())
        old_path = self.page.cached_path
        child_path = child.cached_path
        self.page.slug = "new-contact"
        self.page.save(update_fields=["slug"])
        self.page.refresh_from_db()
        self.assertIn("new-contact", self.page.cached_path)
        self.assertEqual(PagePathAlias.objects.get(root=self.root, path=old_path).page, self.page)
        self.assertEqual(PagePathAlias.objects.get(root=self.root, path=child_path).page, child)
        self.page.slug = "latest-contact"
        self.page.save()
        self.assertEqual(
            PagePathAlias.objects.get(root=self.root, path=old_path).page.cached_path, self.page.cached_path
        )

    def test_unpublished_page_does_not_create_alias(self):
        draft = WebPage.objects.create(
            created_by=self.user,
            last_modified_by=self.user,
            tenant=self.tenant,
            parent=self.root,
            title="Draft",
            slug="draft",
        )
        draft.slug = "changed"
        draft.save()
        self.assertFalse(PagePathAlias.objects.filter(page=draft).exists())

    def test_review_is_tenant_scoped_and_detects_concurrent_edits(self):
        row = PublicFormSubmission.objects.create(
            tenant=self.tenant,
            page=self.page,
            page_version_id=self.version.id,
            widget_id="event-proposal",
            data={"title": "Proposal", "status": "accepted"},
        )
        self.assertEqual(self.call().data["results"][0]["status"], "pending")
        result = self.call("patch", {"status": "accepted", "expected_reviewed_at": None}, pk=row.pk)
        self.assertEqual(result.status_code, 200)
        self.assertEqual(
            self.call("patch", {"status": "rejected", "expected_reviewed_at": None}, pk=row.pk).status_code, 409
        )
        self.assertEqual(PageVersion.objects.filter(page=self.page).count(), 1)
        other = Tenant.objects.create(name="Other", identifier="other-website", created_by=self.user)
        row.tenant = other
        row.save()
        self.assertEqual(
            self.call("patch", {"status": "accepted", "expected_reviewed_at": None}, pk=row.pk).status_code, 404
        )
        self.assertEqual(self.call().data["count"], 0)

    def test_read_only_member_cannot_read_private_submissions(self):
        reader = get_user_model().objects.create_user(username="reader")
        self.tenant.members.add(reader)
        self.assertEqual(self.call(user=reader).status_code, 403)

    def test_raw_form_insert_gets_moderation_defaults(self):
        import uuid

        with connection.cursor() as cursor:
            cursor.execute(
                "INSERT INTO webpages_publicformsubmission (id,tenant_id,page_id,page_version_id,widget_id,form_title,data,submitted_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING status,review_note",
                [uuid.uuid4(), self.tenant.pk, self.page.pk, self.version.pk, "form", "Title", "{}", timezone.now()],
            )
            self.assertEqual(cursor.fetchone(), ("pending", ""))

    def test_website_settings_validate_at_write_boundary(self):
        self.assertEqual(
            validate_website_settings({"language": "sv-SE", "translations": {"en": "7"}})["language"], "sv-SE"
        )
        for value in (
            {"analytics_enabled": "yes"},
            {"translations": {"en": "//external"}},
            {"share_image_id": "javascript:bad"},
        ):
            with self.assertRaises(ValidationError):
                validate_website_settings(value)

    def test_anonymous_pageviews_do_not_claim_identifiable_unique_visitors(self):
        from datetime import timedelta
        from site_statistics.models import EventRaw, PageStats
        from site_statistics.tasks import aggregate_daily_stats

        at = timezone.now() - timedelta(days=1)
        for _ in range(2):
            EventRaw.objects.create(
                tenant=self.tenant,
                user_id="anonymous",
                event_type="pageview",
                url="https://example.org/news/",
                event_time=at,
            )
        aggregate_daily_stats()
        stats = PageStats.objects.get(tenant=self.tenant, date=at.date())
        self.assertEqual(stats.pageviews, 2)
        self.assertEqual(stats.unique_visitors, 0)

    def test_first_publication_does_not_replace_an_existing_historical_alias(self):
        from webpages.services.page_version_workflow import PageVersionWorkflowService

        draft = WebPage.objects.create(
            created_by=self.user,
            last_modified_by=self.user,
            tenant=self.tenant,
            parent=self.root,
            title="Draft",
            slug="draft",
        )
        alias = PagePathAlias.objects.create(tenant=self.tenant, root=self.root, page=self.page, path=draft.cached_path)
        version = PageVersion.objects.create(
            page=draft,
            version_number=1,
            created_by=self.user,
            page_data={"page_attributes": {"slug": "new-public-address"}},
        )
        PageVersionWorkflowService(draft, self.user).publish(version)
        alias.refresh_from_db()
        self.assertEqual(alias.page_id, self.page.pk)
        draft.refresh_from_db()
        self.assertEqual(draft.slug, "new-public-address")

    def test_translation_language_keys_survive_the_real_wire_parser_and_renderer(self):
        import io
        import json
        from djangorestframework_camel_case.parser import CamelCaseJSONParser
        from djangorestframework_camel_case.render import CamelCaseJSONRenderer

        source = {"pageData": {"website": {"noIndex": True, "translations": {"zh-Hant-TW": "24", "sv-SE": "23"}}}}
        parsed = CamelCaseJSONParser().parse(io.BytesIO(json.dumps(source).encode()))
        settings = parsed["page_data"]["website"]
        validate_website_settings(settings)
        self.assertEqual(settings["translations"], source["pageData"]["website"]["translations"])
        self.assertEqual(json.loads(CamelCaseJSONRenderer().render(parsed)), source)
