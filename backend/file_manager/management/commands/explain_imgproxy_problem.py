import base64
import binascii
import hashlib
import hmac
import requests
from django.core.management.base import BaseCommand
from django.conf import settings
from file_manager.imgproxy import imgproxy_service

class Command(BaseCommand):
    help = "Debug imgproxy 403 Forbidden errors by analyzing signatures and source accessibility"

    def add_arguments(self, parser):
        parser.add_argument("url", help="The full imgproxy URL that is failing with 403")

    def handle(self, *args, **options):
        url = options["url"]
        self.stdout.write(self.style.SUCCESS(f"Analyzing imgproxy URL: {url}"))

        # 1. Parse URL
        from urllib.parse import urlparse
        u = urlparse(url)
        path = u.path.lstrip("/")
        parts = path.split("/")

        if not parts or len(parts) < 2:
            self.stdout.write(self.style.ERROR("Invalid imgproxy URL format."))
            return

        signature = parts[0]
        processing_path = "/" + "/".join(parts[1:])
        
        self.stdout.write(f"\n[1] URL Components:")
        self.stdout.write(f"  Signature: {signature}")
        self.stdout.write(f"  Signed Path: {processing_path}")

        # 2. Verify Signature
        self.stdout.write(f"\n[2] Signature Verification:")
        key = getattr(settings, "IMGPROXY_KEY", None)
        salt = getattr(settings, "IMGPROXY_SALT", None)

        if not key or not salt:
            self.stdout.write(self.style.WARNING("  IMGPROXY_KEY or IMGPROXY_SALT not found in settings."))
        else:
            try:
                key_bytes = bytes.fromhex(key)
                salt_bytes = bytes.fromhex(salt)
                msg = salt_bytes + processing_path.encode("utf-8")
                expected_sig = base64.urlsafe_b64encode(
                    hmac.new(key_bytes, msg, hashlib.sha256).digest()
                ).decode().rstrip("=")
                
                if hmac.compare_digest(signature, expected_sig):
                    self.stdout.write(self.style.SUCCESS(f"  MATCH: Signature is valid for the current server keys."))
                else:
                    self.stdout.write(self.style.ERROR(f"  MISMATCH: Signature is INVALID."))
                    self.stdout.write(f"  Expected: {expected_sig}")
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"  Error verifying signature: {e}"))

        # 3. Decode Source URL
        self.stdout.write(f"\n[3] Source URL Analysis:")
        source_segment = parts[-1]
        # Remove extension if present (e.g. .webp)
        if "." in source_segment:
            source_segment = source_segment.split(".")[0]
        
        try:
            # Add padding
            pad = "=" * (-len(source_segment) % 4)
            source_url = base64.urlsafe_b64decode(source_segment + pad).decode("utf-8")
            self.stdout.write(f"  Decoded Source: {source_url}")
            
            # 4. Check Source Accessibility
            self.stdout.write(f"\n[4] Source Accessibility Check:")
            if source_url.startswith("s3://"):
                self.stdout.write("  Source uses s3:// protocol. Checking if imgproxy can access it requires checking imgproxy logs or S3 credentials.")
                # Try to resolve to public URL for a quick check
                from file_manager.storage import storage
                if hasattr(storage, 'get_public_url'):
                    # Extract path from s3://bucket/path
                    s3_parts = source_url.replace("s3://", "").split("/", 1)
                    if len(s3_parts) > 1:
                        public_url = storage.get_public_url(s3_parts[1])
                        self.stdout.write(f"  Attempting to check public equivalent: {public_url}")
                        try:
                            resp = requests.head(public_url, timeout=5)
                            if resp.status_code == 200:
                                self.stdout.write(self.style.SUCCESS(f"  Public equivalent is accessible (HTTP 200)."))
                            else:
                                self.stdout.write(self.style.ERROR(f"  Public equivalent returned HTTP {resp.status_code}."))
                        except Exception as e:
                            self.stdout.write(self.style.ERROR(f"  Could not check public equivalent: {e}"))
            else:
                try:
                    resp = requests.head(source_url, timeout=5)
                    self.stdout.write(f"  HTTP Status: {resp.status_code}")
                    if resp.status_code == 200:
                        self.stdout.write(self.style.SUCCESS("  Source is publicly accessible."))
                    else:
                        self.stdout.write(self.style.ERROR(f"  Source returned {resp.status_code}. Imgproxy might be failing to fetch it."))
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"  Failed to connect to source: {e}"))
                    
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"  Failed to decode source URL: {e}"))

        self.stdout.write("\n" + "=" * 60)
        self.stdout.write("Debug complete.")
