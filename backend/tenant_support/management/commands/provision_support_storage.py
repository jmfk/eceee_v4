from botocore.exceptions import ClientError
from django.core.management.base import BaseCommand, CommandError

from tenant_support import storage


class Command(BaseCommand):
    help = "Create/check the separate private support bucket. Never changes another bucket's policy."

    def handle(self, *args, **options):
        try:
            s3, name = storage.client(), storage.bucket_name()
            try:
                s3.head_bucket(Bucket=name)
            except ClientError as exc:
                if exc.response["Error"]["Code"] not in {"404", "NoSuchBucket", "NotFound"}:
                    raise
                args = {"Bucket": name, "ACL": "private"}
                region = s3.meta.region_name
                if region and region != "us-east-1":
                    args["CreateBucketConfiguration"] = {"LocationConstraint": region}
                s3.create_bucket(**args)
            storage.assert_private(s3)
        except Exception:
            raise CommandError(
                "Private support storage unavailable; verify bucket configuration and permissions."
            ) from None
        self.stdout.write("Private support storage: ready")
