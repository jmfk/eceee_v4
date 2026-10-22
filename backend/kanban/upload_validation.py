"""Reuse media validation policy without buffering an entire instruction video."""

import hashlib
from io import BytesIO

from django.core.files.uploadedfile import UploadedFile

from file_manager.security import FileUploadValidator

CHUNK_SIZE = 1024 * 1024


class KanbanUploadValidator(FileUploadValidator):
    @classmethod
    def _validate_file_content(cls, uploaded_file, results):
        # libmagic needs a header sample; retain the original filename and size
        # so the shared extension/type/size policy still validates the real file.
        uploaded_file.seek(0)
        sample = UploadedFile(
            file=BytesIO(uploaded_file.read(65536)),
            name=uploaded_file.name,
            content_type=uploaded_file.content_type,
            size=uploaded_file.size,
        )
        try:
            super()._validate_file_content(sample, results)
        finally:
            sample.close()
            uploaded_file.seek(0)

    @classmethod
    def _validate_file_security(cls, uploaded_file, results):
        if not results["is_valid"]:
            return
        uploaded_file.seek(0)
        digest = hashlib.sha256()
        overlap = b""
        prefix = None
        is_image = results["metadata"].get("file_type") == "image"
        actual_type = results["metadata"]["actual_mime_type"]
        results["metadata"]["content_type"] = actual_type
        results["content_type"] = actual_type
        try:
            while chunk := uploaded_file.read(CHUNK_SIZE):
                digest.update(chunk)
                if prefix is None:
                    prefix = chunk[:32]
                # Keep both the true header and enough overlap for every shared
                # security marker, even when a marker straddles two chunks.
                sample = prefix + overlap + chunk
                if is_image:
                    cls._check_image_security(sample, results)
                else:
                    cls._check_malicious_patterns(sample, results)
                if not results["is_valid"]:
                    return
                overlap = chunk[-64:]
            results["metadata"]["file_hash"] = digest.hexdigest()
            results["warnings"] = list(dict.fromkeys(results["warnings"]))
        finally:
            uploaded_file.seek(0)
