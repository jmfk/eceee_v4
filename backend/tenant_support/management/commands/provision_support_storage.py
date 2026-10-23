from urllib.parse import urlsplit

from botocore.exceptions import ClientError
from django.core.management.base import BaseCommand, CommandError

from tenant_support import storage

# Never include provider messages, request URLs, headers or arbitrary error codes.
SAFE_PROVIDER_CODES = {
    "AccessDenied",
    "InvalidAccessKeyId",
    "SignatureDoesNotMatch",
    "InvalidArgument",
    "InvalidLocationConstraint",
    "IllegalLocationConstraintException",
    "InvalidBucketName",
    "BucketAlreadyExists",
    "BucketAlreadyOwnedByYou",
    "NoSuchBucket",
    "NoSuchBucketPolicy",
    "NotImplemented",
    "AuthorizationHeaderMalformed",
    "PermanentRedirect",
    "OperationAborted",
    "TooManyBuckets",
    "ServiceUnavailable",
    "InternalError",
    "400",
    "403",
    "404",
    "409",
}


class Command(BaseCommand):
    help = "Create/check the separate private support bucket. Never changes another bucket's policy."

    def handle(self, *args, **options):
        stage = "configuration"
        try:
            s3, name = storage.client(), storage.bucket_name()
            stage = "HeadBucket"
            try:
                s3.head_bucket(Bucket=name)
            except ClientError as exc:
                if exc.response["Error"]["Code"] not in {"404", "NoSuchBucket", "NotFound"}:
                    raise
                create_args = {"Bucket": name, "ACL": "private"}
                region = s3.meta.region_name
                hostname = urlsplit(s3.meta.endpoint_url).hostname or ""
                # Akamai's S3 API selects the location through the regional endpoint.
                # Keep AWS's explicit location constraint for non-default regions.
                if region and region != "us-east-1" and not hostname.endswith(".linodeobjects.com"):
                    create_args["CreateBucketConfiguration"] = {"LocationConstraint": region}
                stage = "CreateBucket"
                s3.create_bucket(**create_args)
            stage = "privacy verification"
            storage.assert_private(s3)
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code")
            code = code if isinstance(code, str) and code in SAFE_PROVIDER_CODES else "unclassified provider error"
            raise CommandError(f"Private support storage failed at {stage}: {code}.") from None
        except Exception:
            raise CommandError(
                f"Private support storage failed at {stage}; verify configuration, connectivity and privacy."
            ) from None
        self.stdout.write("Private support storage: ready")
