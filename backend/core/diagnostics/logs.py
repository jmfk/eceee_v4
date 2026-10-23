"""Read only sanitized immutable export segments, with bounded scan continuation."""

import json
import os
import re
import stat
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from django.conf import settings
from rest_framework import exceptions

from .access import Gone, Unavailable, global_allowed, make_cursor, read_cursor, require_global, time_window
from .events import SERVICES, sanitize_event

NAME = re.compile(r"[0-9]{8}T[0-9]{12}-[a-f0-9]{32}\.json\Z")
MAX_SCAN = 20 * 1024 * 1024


def read_json(path, maximum=MAX_SCAN):
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
        with os.fdopen(fd, "rb") as handle:
            info = os.fstat(handle.fileno())
            if not stat.S_ISREG(info.st_mode) or info.st_size > maximum:
                raise Unavailable()
            raw = handle.read(maximum + 1)
            if len(raw) > maximum:
                raise Unavailable()
            return json.loads(raw)
    except FileNotFoundError:
        raise Gone() from None
    except (OSError, ValueError, TypeError):
        raise Unavailable() from None


def export_root():
    return Path(settings.DIAGNOSTICS_EXPORT_ROOT)


def manifest(generation=None):
    if generation and not NAME.fullmatch(generation + ".json"):
        raise Gone()
    path = export_root() / "generations" / (generation + ".json") if generation else export_root() / "latest.json"
    result = read_json(path, 2 * 1024 * 1024)
    if not isinstance(result, dict) or not isinstance(result.get("segments"), list):
        raise Unavailable()
    if any(not isinstance(name, str) or not NAME.fullmatch(name) for name in result["segments"]):
        raise Unavailable()
    return result


def source_inventory(request):
    try:
        current = manifest()
    except Gone:
        raise Unavailable("No diagnostic export has been collected.") from None
    result = {"sources": [{"id": service} for service in SERVICES]}
    if global_allowed(request):
        result.update(
            {key: current.get(key) for key in ("created_at", "retention_limited", "incomplete", "oldest_export_at")}
        )
        result["health"] = current.get("sources", {})
        gaps = current.get("gaps", [])
        result["gaps"] = gaps[-100:]
        result["gap_count"] = len(gaps)
        result["gaps_limited"] = len(gaps) > 100
        result["stale"] = datetime.fromisoformat(current["created_at"]) < datetime.now(timezone.utc) - timedelta(
            minutes=3
        )
    return result


def visible(event, tenants, include_global):
    tenant = event.get("tenant_id")
    return tenant in tenants if tenant else include_global


def checked_events(name):
    rows = read_json(export_root() / "segments" / name)
    if not isinstance(rows, list):
        raise Unavailable()
    for raw in rows:
        if not isinstance(raw, dict):
            continue
        # Defense in depth: even a malformed export cannot pass raw extra fields through the API.
        event = sanitize_event(raw, raw.get("service"), trusted=True)
        if event and isinstance(raw.get("id"), str) and re.fullmatch(r"[a-f0-9]{64}", raw["id"]):
            event["id"] = name[:-5] + "." + raw["id"]
            yield event


def search_logs(request, data, tenants):
    include_global = data.get("include_global", False)
    if include_global:
        require_global(request)
    signature = {**data, "tenants": tenants, "global_access": global_allowed(request)}
    signature.pop("cursor", None)
    state = read_cursor(data.get("cursor"), request, signature)
    start, end = (state["start"], state["end"]) if state else time_window(data.get("start"), data.get("end"))
    try:
        current = manifest(state["generation"] if state else None)
    except Gone:
        if state:
            raise
        raise Unavailable("No diagnostic export has been collected.") from None
    names = list(reversed(current["segments"]))
    segment_index, row_index = (state["segment"], state["row"]) if state else (0, 0)
    results, scanned = [], 0
    deadline = time.monotonic() + 5
    text = data.get("text", "").casefold()
    finished = False
    while segment_index < len(names):
        name = names[segment_index]
        try:
            size = (export_root() / "segments" / name).stat().st_size
        except OSError:
            raise Gone() from None
        if scanned + size > MAX_SCAN or time.monotonic() >= deadline:
            break
        scanned += size
        rows = list(checked_events(name))
        while row_index < len(rows):
            event = rows[row_index]
            row_index += 1
            if not visible(event, tenants, include_global) or not start <= event["time"] <= end:
                continue
            if data.get("source") and event["service"] != data["source"]:
                continue
            if data.get("level") and event["level"] != data["level"]:
                continue
            if data.get("request_id") and event["request_id"] != str(data["request_id"]):
                continue
            if (
                text
                and text
                not in (event["message"] + " " + event["error_class"] + " " + json.dumps(event["frames"])).casefold()
            ):
                continue
            results.append(event)
            if len(results) == data["limit"]:
                finished = True
                break
        if row_index >= len(rows):
            segment_index += 1
            row_index = 0
        if finished:
            break
    more = segment_index < len(names)
    groups = {}
    for event in results:
        group = groups.setdefault(
            event["group_id"], {"group_id": event["group_id"], "error_class": event["error_class"], "count_in_page": 0}
        )
        group["count_in_page"] += 1
    return {
        "results": results,
        "groups": list(groups.values()),
        "start": start,
        "end": end,
        "generation": current["generation"],
        "incomplete": current.get("incomplete", True),
        "limited": more,
        **({"bytes_scanned": scanned} if global_allowed(request) else {}),
        "next_cursor": (
            make_cursor(
                request,
                signature,
                generation=current["generation"],
                segment=segment_index,
                row=row_index,
                start=start,
                end=end,
            )
            if more
            else None
        ),
    }


def event_details(request, event_id, tenants, include_global):
    if include_global:
        require_global(request)
    try:
        name, digest = event_id.rsplit(".", 1)
    except ValueError:
        raise exceptions.NotFound() from None
    if not NAME.fullmatch(name + ".json") or not re.fullmatch(r"[a-f0-9]{64}", digest):
        raise exceptions.NotFound()
    for event in checked_events(name + ".json"):
        if event["id"] == event_id and visible(event, tenants, include_global):
            return event
    raise exceptions.NotFound()
