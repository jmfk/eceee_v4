"""Bounded media inspection of local temporary files, with no network protocols."""

import json
import subprocess
from decimal import Decimal, InvalidOperation

from django.conf import settings
from rest_framework.exceptions import ValidationError


def run(command, timeout):
    try:
        result = subprocess.run(command, capture_output=True, timeout=timeout, check=True)
        return result.stdout.decode("utf-8")
    except (OSError, subprocess.SubprocessError, UnicodeError):
        raise ValidationError({"video": "Videon kunde inte valideras. Välj en giltig MP4- eller WebM-fil."}) from None


def inspect_video(path, purpose):
    raw = run(
        [
            settings.SUPPORT_FFPROBE,
            "-v",
            "error",
            "-format_whitelist",
            "mov,matroska,webm",
            "-protocol_whitelist",
            "file,pipe",
            "-show_entries",
            "format=duration,format_name:stream=codec_type,codec_name,width,height",
            "-of",
            "json",
            path,
        ],
        15,
    )
    try:
        data = json.loads(raw)
        duration = Decimal(data["format"]["duration"])
        streams = data["streams"]
        formats = data["format"]["format_name"].split(",")
        if not duration.is_finite() or duration <= 0:
            raise ValueError
    except (KeyError, ValueError, InvalidOperation, TypeError):
        raise ValidationError({"video": "Videons längd kunde inte fastställas."}) from None
    videos = [s for s in streams if s.get("codec_type") == "video"]
    if len(videos) != 1:
        raise ValidationError({"video": "Välj en video med ett videospår."})
    width, height = videos[0].get("width", 0), videos[0].get("height", 0)
    if not width or not height or max(width, height) > 3840 or width * height > 3840 * 2160:
        raise ValidationError({"video": "Använd en video med högst 4K-upplösning."})
    codec = videos[0].get("codec_name")
    if "mp4" in formats and codec == "h264":
        content_type, extension = "video/mp4", "mp4"
    elif "webm" in formats and codec in {"vp8", "vp9"}:
        content_type, extension = "video/webm", "webm"
    else:
        raise ValidationError(
            {"video": "Använd MP4 med H.264 eller WebM med VP8/VP9. Exportera MOV/HEVC till MP4 först."}
        )
    if any(s.get("codec_type") not in {"audio", "video"} for s in streams) or len(streams) > 2:
        raise ValidationError({"video": "Videon innehåller spår som inte stöds."})
    audio = [s.get("codec_name") for s in streams if s.get("codec_type") == "audio"]
    if any(c not in ({"aac", "mp3"} if extension == "mp4" else {"opus", "vorbis"}) for c in audio):
        raise ValidationError({"video": "Videons ljudformat stöds inte."})
    command = [
        settings.SUPPORT_FFMPEG,
        "-v",
        "error",
        "-xerror",
        "-nostdin",
        "-threads",
        "1",
        "-format_whitelist",
        "mov,matroska,webm",
        "-protocol_whitelist",
        "file,pipe",
        "-i",
        path,
    ]
    if purpose == "bug":
        if duration > 5:
            raise ValidationError({"video": "Bugginspelningen får vara högst 5 sekunder."})
        # Decode all streams as well: container metadata alone is not trusted.
        progress = run(command + ["-progress", "pipe:1", "-nostats", "-f", "null", "-"], 30)
        times = [
            Decimal(line.split("=", 1)[1]) / 1000000
            for line in progress.splitlines()
            if line.startswith("out_time_us=") and line.split("=", 1)[1] != "N/A"
        ]
        if not times or max(times) > 5:
            raise ValidationError({"video": "Den avkodade bugginspelningen får vara högst 5 sekunder."})
        duration = max(duration, max(times))
    else:
        run(command + ["-frames:v", "1", "-an", "-f", "null", "-"], 15)
    return duration, content_type, extension
