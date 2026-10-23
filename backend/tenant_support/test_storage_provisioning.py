from io import StringIO
from unittest.mock import patch

from botocore.exceptions import ClientError, EndpointConnectionError
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase


def provider_error(code):
    return ClientError({"Error": {"Code": code, "Message": "sensitive-provider-details"}}, "test")


@patch("tenant_support.management.commands.provision_support_storage.storage", autospec=True)
class ProvisionSupportStorageTests(SimpleTestCase):
    def make_client(self, storage, endpoint="https://eu-central-1.linodeobjects.com", region="eu-central-1"):
        client = storage.client.return_value
        client.meta.endpoint_url = endpoint
        client.meta.region_name = region
        storage.bucket_name.return_value = "support-private-tests"
        return client

    def run_command(self):
        call_command("provision_support_storage", stdout=StringIO())

    def test_linode_creation_uses_regional_endpoint_and_private_acl(self, storage):
        client = self.make_client(storage)
        client.head_bucket.side_effect = provider_error("404")
        self.run_command()
        client.create_bucket.assert_called_once_with(Bucket="support-private-tests", ACL="private")
        storage.assert_private.assert_called_once_with(client)

    def test_aws_regional_creation_preserves_location_constraint(self, storage):
        client = self.make_client(storage, "https://s3.eu-central-1.amazonaws.com")
        client.head_bucket.side_effect = provider_error("NoSuchBucket")
        self.run_command()
        client.create_bucket.assert_called_once_with(
            Bucket="support-private-tests",
            ACL="private",
            CreateBucketConfiguration={"LocationConstraint": "eu-central-1"},
        )

    def test_default_region_omits_location_constraint(self, storage):
        client = self.make_client(storage, "https://s3.amazonaws.com", "us-east-1")
        client.head_bucket.side_effect = provider_error("NotFound")
        self.run_command()
        client.create_bucket.assert_called_once_with(Bucket="support-private-tests", ACL="private")

    def test_existing_bucket_is_verified_without_mutation(self, storage):
        client = self.make_client(storage)
        self.run_command()
        client.create_bucket.assert_not_called()
        storage.assert_private.assert_called_once_with(client)

    def test_access_denied_does_not_trigger_creation(self, storage):
        client = self.make_client(storage)
        client.head_bucket.side_effect = provider_error("AccessDenied")
        with self.assertRaisesRegex(CommandError, "HeadBucket: AccessDenied"):
            self.run_command()
        client.create_bucket.assert_not_called()
        storage.assert_private.assert_not_called()

    def test_create_failure_identifies_step_without_provider_message(self, storage):
        client = self.make_client(storage)
        client.head_bucket.side_effect = provider_error("404")
        client.create_bucket.side_effect = provider_error("InvalidLocationConstraint")
        with self.assertRaises(CommandError) as caught:
            self.run_command()
        self.assertEqual(
            str(caught.exception), "Private support storage failed at CreateBucket: InvalidLocationConstraint."
        )
        storage.assert_private.assert_not_called()

    def test_arbitrary_provider_error_and_transport_details_are_redacted(self, storage):
        client = self.make_client(storage)
        for error in [
            provider_error("sensitive-provider-details"),
            EndpointConnectionError(endpoint_url="https://secret.invalid"),
        ]:
            with self.subTest(error=type(error).__name__):
                client.head_bucket.side_effect = error
                with self.assertRaises(CommandError) as caught:
                    self.run_command()
                self.assertNotIn("sensitive-provider-details", str(caught.exception))
                self.assertNotIn("secret.invalid", str(caught.exception))
        client.create_bucket.assert_not_called()

    def test_failed_privacy_verification_still_fails_closed(self, storage):
        self.make_client(storage)
        storage.assert_private.side_effect = ValueError("sensitive-provider-details")
        with self.assertRaisesRegex(CommandError, "privacy verification"):
            self.run_command()

    def test_invalid_configuration_does_not_touch_provider(self, storage):
        client = self.make_client(storage)
        storage.bucket_name.side_effect = ValueError("sensitive-config")
        with self.assertRaisesRegex(CommandError, "configuration"):
            self.run_command()
        client.head_bucket.assert_not_called()
        client.create_bucket.assert_not_called()
