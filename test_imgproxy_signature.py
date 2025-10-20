#!/usr/bin/env python3
"""
Test imgproxy signature generation to debug signature mismatches.
"""
import hashlib
import hmac
import base64

# Your actual production keys
IMGPROXY_KEY = "d69b95c256dcaaff8cc1ca8bfb78b0881fa585a39756c33bb6411e842ddcac13"
IMGPROXY_SALT = "e2d55a2c41fe35ff5fb42795c29d6b1184a9385b09b4ab544a1542fd60bfb308"

# Example from your error log
path = "/resize:fit:400:300/aHR0cHM6Ly9ldS1jZW50cmFsLTEubGlub2Rlb2JqZWN0cy5jb20vZWNlZWUtdjQtbWVkaWEvdXBsb2Fkcy9lY2ZkMWY0MC0xZGFmLTRkNjctOTIzOS04ZmQzMGM5NDU3OGIucG5n"
expected_signature = "RZsM52TknXEi1tSseRTtfTznuBJcjU3b"

print("Testing imgproxy signature generation")
print("=" * 60)
print(f"Path: {path}")
print(f"Expected signature: {expected_signature}")
print()

# Convert hex keys to bytes
key_bytes = bytes.fromhex(IMGPROXY_KEY)
salt_bytes = bytes.fromhex(IMGPROXY_SALT)

print(f"Key length: {len(key_bytes)} bytes")
print(f"Salt length: {len(salt_bytes)} bytes")
print()

# Generate signature using Django's method
digest = hmac.new(
    key_bytes,
    msg=salt_bytes + path.encode(),
    digestmod=hashlib.sha256,
).digest()

signature_full = base64.urlsafe_b64encode(digest).decode()
print(f"Full signature (before truncation): {signature_full}")
print(f"Full signature length: {len(signature_full)}")
print()

# Truncate to 32 characters
signature_32 = signature_full[:32].rstrip("=")
print(f"Truncated signature (32 chars): {signature_32}")
print(f"Matches expected? {signature_32 == expected_signature}")
print()

# Also test without removing padding
signature_32_with_padding = signature_full[:32]
print(f"Signature with padding: {signature_32_with_padding}")
print(f"Matches expected? {signature_32_with_padding == expected_signature}")
print()

# Test base64 standard encoding (not URL-safe)
digest_standard = hmac.new(
    key_bytes,
    msg=salt_bytes + path.encode(),
    digestmod=hashlib.sha256,
).digest()
signature_standard = base64.b64encode(digest_standard).decode()[:32].rstrip("=")
print(f"Standard base64 (not URL-safe): {signature_standard}")
print(f"Matches expected? {signature_standard == expected_signature}")
