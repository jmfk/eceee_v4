"""Host-only bounded log export. Standard library only; never invoked by the API."""

import argparse
import fcntl
import json
import os
import re
import selectors
import signal
import stat
import subprocess
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from .events import ERRORS, SERVICES, canonical, decode_signed, sanitize_event

MAX_INPUT = 20 * 1024 * 1024
MAX_STORAGE = 256 * 1024 * 1024
MAX_LINE = 32768


def protected_key(path):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, "rb") as handle:
        mode = os.fstat(handle.fileno()).st_mode
        if not stat.S_ISREG(mode) or stat.S_IMODE(mode) & 0o077:
            raise ValueError("signing_key=mode_unsafe")
        key = handle.read(4097).strip()
        if not 32 <= len(key) <= 4096:
            raise ValueError("signing_key=invalid")
        return key


def atomic_json(path, value):
    temporary = path.with_name("." + path.name + ".tmp")
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o640)
    with os.fdopen(fd, "wb") as handle:
        handle.write(canonical(value))
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, path)


def bounded_lines(command, deadline, budget):
    """Kill/drain promptly on deadline, bytes or oversized input; never buffer raw output."""
    with subprocess.Popen(
        command, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, start_new_session=True
    ) as process:
        selector = selectors.DefaultSelector()
        selector.register(process.stdout, selectors.EVENT_READ)
        pending = b""
        try:
            while time.monotonic() < deadline and budget[0] > 0:
                if not selector.select(min(0.1, max(0, deadline - time.monotonic()))):
                    if process.poll() is not None:
                        break
                    continue
                chunk = os.read(process.stdout.fileno(), min(8192, budget[0]))
                if not chunk:
                    process.wait(timeout=max(0.01, deadline - time.monotonic()))
                    break
                budget[0] -= len(chunk)
                pending += chunk
                while b"\n" in pending:
                    line, pending = pending.split(b"\n", 1)
                    if len(line) <= MAX_LINE:
                        yield line.decode("utf-8", errors="replace")
                if len(pending) > MAX_LINE:
                    budget[0] = 0  # Report truncation rather than retaining unbounded raw data.
                    break
            if process.poll() not in (None, 0):
                raise RuntimeError("source=unavailable")
            if process.poll() is None and (budget[0] <= 0 or time.monotonic() >= deadline):
                raise TimeoutError("source=bounded")
        finally:
            selector.close()
            if process.poll() is None:
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
            process.wait(timeout=2)


def timestamped(line):
    timestamp, _, body = line.partition(" ")
    try:
        # Docker timestamps may use nanoseconds. Python retains microseconds consistently.
        parsed = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            raise ValueError()
        return parsed.astimezone(timezone.utc).isoformat(), body
    except ValueError:
        return None, line


def legacy_event(line, timestamp, service):
    # Extract only a recognized exception *type*, never its human-readable value.
    match = re.match(r"^(?:[A-Za-z_][A-Za-z0-9_]*\.)*([A-Za-z]+)(?::|$)", line)
    if not timestamp or not match or match[1] not in ERRORS:
        return None
    return sanitize_event({"time": timestamp, "error_class": match[1], "level": "ERROR"}, service)


def open_registered_file(path):
    # Resolve each component with no-follow semantics so a parent-directory swap cannot redirect a read.
    directory = os.open("/", os.O_RDONLY | os.O_DIRECTORY)
    try:
        for component in path.parts[1:-1]:
            following = os.open(component, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=directory)
            os.close(directory)
            directory = following
        return os.open(path.name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=directory)
    finally:
        os.close(directory)


def collect(root, repository, key, file_sources=()):
    root.mkdir(parents=True, exist_ok=True, mode=0o750)
    for name in ("segments", "generations"):
        (root / name).mkdir(exist_ok=True, mode=0o750)
    # One writer, including overlapping timer/manual invocations.
    with (root / ".collector.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return _collect(root, repository, key, file_sources)


def _collect(root, repository, key, file_sources):
    now = datetime.now(timezone.utc)
    deadline = time.monotonic() + 28
    budget = [MAX_INPUT]
    state_path = root / ".positions.json"
    previous = json.loads(state_path.read_text()) if state_path.exists() else {}
    state = dict(previous)
    events = {}
    seen_path = root / ".seen.json"
    seen = json.loads(seen_path.read_text()) if seen_path.exists() else {}
    seen = {k: v for k, v in seen.items() if v > (now - timedelta(hours=1)).isoformat()}
    progress = {}
    containers_path = root / ".containers.json"
    containers = json.loads(containers_path.read_text()) if containers_path.exists() else {}
    gaps_path = root / ".gaps.json"
    gaps = json.loads(gaps_path.read_text()) if gaps_path.exists() else []
    gaps = [g for g in gaps if g["time"] > (now - timedelta(days=7)).isoformat()]
    health = {}
    compose = [
        "docker",
        "compose",
        "-f",
        str(repository / "deploy/docker-compose.prod.yml"),
        "--env-file",
        str(repository / "deploy/.env"),
    ]

    # Ingestion is authenticated by signature; unsigned records are always global.
    def consume(lines, service, position):
        last = position
        count = 0
        for line in lines:
            timestamp, body = timestamped(line)
            event = decode_signed(body, service, key) or legacy_event(body, timestamp, service)
            if timestamp:
                last = max(last, timestamp)
                progress[service] = last
            if event and event["id"] not in seen:
                if len(events) >= 10000:
                    budget[0] = 0
                    raise TimeoutError("event_limit")
                events[event["id"]] = event
                seen[event["id"]] = now.isoformat()
            elif event is None:
                count += 1
        return last, count

    for service in SERVICES:
        position = previous.get(service, (now - timedelta(hours=1)).isoformat())
        since = (datetime.fromisoformat(position) - timedelta(seconds=1)).isoformat()
        source_budget = budget[0]
        entry = {"status": "ok", "coverage_start": since, "coverage_end": now.isoformat(), "unknown_records": 0}
        try:
            if time.monotonic() >= deadline or budget[0] <= 0:
                raise TimeoutError()
            identities = list(bounded_lines(compose + ["ps", "-q", service], deadline, budget))
            identity = ",".join(sorted(i for i in identities if re.fullmatch(r"[a-f0-9]{12,64}", i)))
            if not identity:
                raise RuntimeError("source=missing")
            if containers.get(service) != identity:
                entry["gap_possible"] = True
            containers[service] = identity
            last, unknown = consume(
                bounded_lines(
                    compose + ["logs", "--no-color", "--no-log-prefix", "--timestamps", "--since", since, service],
                    deadline,
                    budget,
                ),
                service,
                position,
            )
            state[service] = max(last, now.isoformat())
            entry["unknown_records"] = unknown
        except (OSError, RuntimeError, TimeoutError):
            entry["status"] = "incomplete"
            if service in progress:
                state[service] = progress[service]
            elif source_budget > 0 and budget[0] == 0:
                # An oversized indivisible record cannot be replayed indefinitely. Report the gap.
                state[service] = now.isoformat()
                entry["gap_possible"] = True
        if entry.get("gap_possible") or entry["status"] != "ok":
            gaps.append({"time": now.isoformat(), "source": service, "reason": "source_changed_or_incomplete"})
        health[service] = entry

    for source in file_sources:
        # Paths are supplied by an operator-owned deployment manifest, never by API clients.
        service = source["service"]
        path = Path(source["path"])
        if service not in SERVICES or not path.is_absolute() or path.resolve() != path:
            raise ValueError("file_source=invalid")
        name = "file:" + source["id"]
        entry = {"status": "ok", "unknown_records": 0}
        try:
            fd = open_registered_file(path)
            with os.fdopen(fd, "rb") as handle:
                info = os.fstat(handle.fileno())
                if not stat.S_ISREG(info.st_mode):
                    raise ValueError("file_source=not_regular")
                marker = [info.st_dev, info.st_ino]
                old = previous.get(name, {})
                offset = old.get("offset", 0)
                dropping = old.get("dropping", False)
                if old.get("identity") != marker or info.st_size < offset:
                    offset = 0
                    dropping = False
                    entry["rotation_gap_possible"] = True
                handle.seek(offset)
                while time.monotonic() < deadline and budget[0] > 0:
                    line = handle.readline(min(MAX_LINE + 1, budget[0]))
                    if not line:
                        break
                    budget[0] -= len(line)
                    if dropping or len(line) > MAX_LINE:
                        entry["rotation_gap_possible"] = True
                        dropping = not line.endswith(b"\n")
                        offset = handle.tell()
                        continue
                    if not line.endswith(b"\n"):
                        entry["status"] = "incomplete"
                        break
                    offset = handle.tell()
                    _, unknown = consume(
                        [line.decode("utf-8", errors="replace").rstrip("\n")], service, now.isoformat()
                    )
                    entry["unknown_records"] += unknown
                if handle.tell() < info.st_size:
                    entry["status"] = "incomplete"
                state[name] = {"identity": marker, "offset": offset, "dropping": dropping}
        except OSError:
            entry["status"] = "unavailable"
        if entry.get("rotation_gap_possible") or entry["status"] != "ok":
            gaps.append({"time": now.isoformat(), "source": name, "reason": "rotation_or_incomplete"})
        health[name] = entry

    generation = now.strftime("%Y%m%dT%H%M%S%f") + "-" + uuid.uuid4().hex
    batch = []
    batch_size = 2

    def flush_batch():
        if batch:
            name = now.strftime("%Y%m%dT%H%M%S%f") + "-" + uuid.uuid4().hex + ".json"
            atomic_json(root / "segments" / name, batch)

    for event in events.values():
        size = len(canonical(event)) + 1
        if batch_size + size > 512 * 1024:
            flush_batch()
            batch, batch_size = [], 2
        batch.append(event)
        batch_size += size
    flush_batch()
    segments = sorted((root / "segments").glob("*.json"))
    total = sum(p.stat().st_size for p in segments)
    removed = False
    for path in list(segments):
        if now.timestamp() - path.stat().st_mtime > 7 * 86400 or total > MAX_STORAGE:
            total -= path.stat().st_size
            path.unlink()
            segments.remove(path)
            removed = True
    manifest = {
        "generation": generation,
        "created_at": now.isoformat(),
        "sources": health,
        "segments": [p.name for p in segments],
        "retention_limited": removed or previous.get("__retention_limited__", False),
        "oldest_export_at": (
            datetime.strptime(segments[0].name.split("-")[0], "%Y%m%dT%H%M%S%f")
            .replace(tzinfo=timezone.utc)
            .isoformat()
            if segments
            else None
        ),
        "bytes_read": MAX_INPUT - budget[0],
        "incomplete": bool(gaps),
        "gaps": gaps[-10000:],
    }
    atomic_json(root / "generations" / (generation + ".json"), manifest)
    if removed:
        state["__retention_limited__"] = True
    atomic_json(state_path, state)
    atomic_json(containers_path, containers)
    atomic_json(gaps_path, gaps[-10000:])
    if len(seen) > 100000:
        seen = dict(sorted(seen.items(), key=lambda item: item[1])[-100000:])
    atomic_json(seen_path, seen)
    atomic_json(root / "latest.json", manifest)
    for path in (root / "generations").glob("*.json"):
        if now.timestamp() - path.stat().st_mtime > 3600:
            path.unlink()
    return {"status": "incomplete" if manifest["incomplete"] else "ok", "events": len(events)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--repository", required=True, type=Path)
    parser.add_argument("--signing-key-file", required=True, type=Path)
    parser.add_argument("--file-sources", type=Path)
    args = parser.parse_args()
    try:
        sources = json.loads(args.file_sources.read_text()) if args.file_sources else []
        result = collect(args.root, args.repository.resolve(), protected_key(args.signing_key_file), sources)
        print(json.dumps(result))
    except Exception:
        print('{"status":"failed"}')
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
