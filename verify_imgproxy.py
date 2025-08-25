#!/usr/bin/env python3
import argparse
import base64
import binascii
import hashlib
import hmac
from urllib.parse import urlparse


def b64url_encode(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def b64url_decode(s: str) -> bytes:
    # add padding back
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def compute_sig(path: str, key_hex: str, salt_hex: str) -> str:
    key = bytes.fromhex(key_hex)
    salt = bytes.fromhex(salt_hex)
    hm = hmac.new(key, salt + path.encode("utf-8"), hashlib.sha256).digest()
    return b64url_encode(hm)


def main():
    ap = argparse.ArgumentParser(
        description="Decode & verify imgproxy URLs (signature + source URL)."
    )
    ap.add_argument("url", help="Full imgproxy URL you are calling")
    # ap.add_argument(
    #     "--key-hex",
    #     required=True,
    #     help="IMGPROXY_KEY in hex",
    #     default="943b421c9eb07c830af81030552c86009268de4e532ba2ee2eab8247c6da0881",
    # )
    # ap.add_argument(
    #     "--salt-hex",
    #     required=True,
    #     help="IMGPROXY_SALT in hex",
    #     default="520f986b998545b4785e0defbc4f3c1203f22de2374a3d53cb7a7fe9fea309c5",
    # )
    args = ap.parse_args()
    key_hex = "943b421c9eb07c830af81030552c86009268de4e532ba2ee2eab8247c6da0881"
    salt_hex = "520f986b998545b4785e0defbc4f3c1203f22de2374a3d53cb7a7fe9fea309c5"

    u = urlparse(args.url)
    raw_path = u.path or ""
    if not raw_path.startswith("/"):
        print("ERROR: URL path must start with '/'.")
        return

    parts = [p for p in raw_path.split("/") if p != ""]
    if not parts:
        print("ERROR: Empty path.")
        return

    first = parts[0]

    if first == "unsafe":
        print(
            "Detected '/unsafe' → no signature expected. If KEY/SALT are set, this will 403."
        )
        signed_path = "/" + "/".join(parts[1:])  # what you'd sign if you were signing
        print(f"(Info) Path after 'unsafe' (would be the signed part): {signed_path}")
        # also decode source url if present
        if len(parts) >= 2:
            last_seg = parts[-1]
            src_enc = last_seg.split(".", 1)[0]  # strip optional .jpg/.webp, etc.
            try:
                src = b64url_decode(src_enc).decode("utf-8", "replace")
                print(f"(Info) Decoded source URL: {src}")
            except binascii.Error as e:
                print(f"(Warn) Could not decode source base64: {e}")
        return

    provided_sig = first
    signed_path = "/" + "/".join(parts[1:])  # IMPORTANT: leading slash included

    print("=== imgproxy signature debug ===")
    print(f"Full URL:          {args.url}")
    print(f"Provided signature: {provided_sig}")

    # Show raw bytes of provided signature
    try:
        provided_sig_bytes = b64url_decode(provided_sig)
        print(f"Provided sig (hex): {provided_sig_bytes.hex()}")
    except binascii.Error as e:
        print(f"Provided sig is not valid base64url: {e}")
        return

    # Compute expected signature
    expected_sig = compute_sig(signed_path, key_hex, salt_hex)
    print(f"Signed path:        {signed_path}")
    print(f"Expected signature: {expected_sig}")

    if hmac.compare_digest(provided_sig, expected_sig):
        print("MATCH ✅  (signature is valid)")
    else:
        print("MISMATCH ❌  (signature is INVALID)")

    # Try to decode the source URL (last segment)
    if parts:
        last_seg = parts[-1]
        # imgproxy allows optional output extension appended to the base64 part
        src_enc = last_seg.split(".", 1)[0]
        try:
            src_bytes = b64url_decode(src_enc)
            src_url = src_bytes.decode("utf-8", "replace")
            print(f"Decoded source URL: {src_url}")
        except binascii.Error as e:
            print(f"(Warn) Could not decode source base64: {e}")


if __name__ == "__main__":
    main()
