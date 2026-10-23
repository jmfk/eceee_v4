"""Separate private bucket; never falls back to the public media origin."""

import json

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


def bucket_name():
    name = settings.SUPPORT_STORAGE_BUCKET_NAME
    if not name or name in {settings.AWS_STORAGE_BUCKET_NAME, settings.AWS_CHECKPOINT_STORAGE_BUCKET_NAME}:
        raise ImproperlyConfigured("Configure a separate SUPPORT_STORAGE_BUCKET_NAME.")
    return name


def client(public=False):
    access_key = getattr(settings, "SUPPORT_STORAGE_ACCESS_KEY_ID", "")
    secret_key = getattr(settings, "SUPPORT_STORAGE_SECRET_ACCESS_KEY", "")
    if bool(access_key) != bool(secret_key):
        raise ImproperlyConfigured("Configure both dedicated support storage credentials.")
    # Local shared storage may retain the existing credentials. Production
    # preflight requires a dedicated pair, keeping imgproxy out of private media.
    if not access_key:
        access_key, secret_key = settings.AWS_ACCESS_KEY_ID, settings.AWS_SECRET_ACCESS_KEY
    endpoint = (
        settings.AWS_S3_ENDPOINT_URL
        if public
        else getattr(settings, "AWS_S3_INTERNAL_ENDPOINT_URL", settings.AWS_S3_ENDPOINT_URL)
    )
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=settings.AWS_S3_REGION_NAME,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": getattr(settings, "AWS_S3_ADDRESSING_STYLE", "path")},
            connect_timeout=5,
            read_timeout=30,
            retries={"max_attempts": 2},
        ),
    )


def assert_private(s3):
    """Fail closed if the dedicated bucket grants any anonymous access."""
    bucket = bucket_name()
    acl = s3.get_bucket_acl(Bucket=bucket)
    for grant in acl.get("Grants", []):
        if grant.get("Grantee", {}).get("URI", "").endswith(("/AllUsers", "/AuthenticatedUsers")):
            raise ImproperlyConfigured("Support bucket must not grant public access.")
    try:
        policy = json.loads(s3.get_bucket_policy(Bucket=bucket)["Policy"])
    except ClientError as exc:
        if exc.response["Error"]["Code"] not in {"NoSuchBucketPolicy", "NoSuchPolicy"}:
            raise
        return
    for statement in policy.get("Statement", []):
        principal = statement.get("Principal")
        aws = principal.get("AWS", []) if isinstance(principal, dict) else principal
        if statement.get("Effect") == "Allow" and (aws == "*" or isinstance(aws, list) and "*" in aws):
            raise ImproperlyConfigured("Support bucket must not allow anonymous access.")


def save_video(path, key, content_type):
    s3 = client()
    assert_private(s3)
    with open(path, "rb") as source:
        s3.upload_fileobj(
            source,
            bucket_name(),
            key,
            ExtraArgs={"ContentType": content_type, "ACL": "private", "CacheControl": "private, no-store"},
        )


def playback_url(key):
    assert_private(client())
    return client(public=True).generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket_name(), "Key": key, "ResponseCacheControl": "private, no-store"},
        ExpiresIn=60,
    )


def download_url(key, filename):
    from django.utils.http import content_disposition_header

    assert_private(client())
    return client(public=True).generate_presigned_url(
        "get_object",
        Params={
            "Bucket": bucket_name(),
            "Key": key,
            "ResponseCacheControl": "private, no-store",
            "ResponseContentDisposition": content_disposition_header(True, filename),
        },
        ExpiresIn=60,
    )
