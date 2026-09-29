from django.test import SimpleTestCase

from webpages.models import PublicFormSubmission


class PublicFormSubmissionModelTests(SimpleTestCase):
    def test_page_version_identity_is_not_a_cascading_relation(self):
        field = PublicFormSubmission._meta.get_field("page_version_id")

        self.assertFalse(field.is_relation)
        self.assertEqual(field.get_internal_type(), "PositiveBigIntegerField")
        self.assertEqual(field.column, "page_version_id")
