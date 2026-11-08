"""Current, reconciled progress for a staged editorial import."""

from collections import Counter, defaultdict

from .source import DEFAULT_RESOURCES

ATTENTION_STATUSES = {"blocked", "conflict", "failed", "pending"}
ERROR_STATUSES = ATTENTION_STATUSES - {"pending"}
SUCCESS_STATUSES = {"imported", "unchanged"}


def build_report(run, *, include_items=False):
    by_resource = defaultdict(Counter)
    by_reason = defaultdict(Counter)
    attention = []
    items = []
    for resource, source_id, status, reason, object_id in run.items.values_list(
        "resource", "source_id", "status", "error_category", "object_instance_id"
    ).iterator():
        by_resource[resource][status] += 1
        if reason and status in ERROR_STATUSES:
            by_reason[resource][reason] += 1
        if status in ERROR_STATUSES:
            attention.append({"resource": resource, "sourceId": source_id, "status": status, "reason": reason or None})
        if include_items:
            items.append(
                {
                    "resource": resource,
                    "sourceId": source_id,
                    "status": status,
                    "reason": reason or None,
                    "objectId": str(object_id) if object_id else None,
                }
            )
    counts = Counter()
    for resource_counts in by_resource.values():
        counts.update(resource_counts)
    total = sum(counts.values())
    result = {
        "total": total,
        "processed": total - counts["pending"],
        "successful": sum(counts[status] for status in SUCCESS_STATUSES),
        "needsAttention": sum(counts[status] for status in ATTENTION_STATUSES),
        "counts": dict(sorted(counts.items())),
        "byResource": {
            resource: {
                "total": sum(by_resource[resource].values()),
                "counts": dict(sorted(by_resource[resource].items())),
            }
            for resource in DEFAULT_RESOURCES
            if resource in by_resource
        },
        "reasons": {resource: dict(sorted(reasons.items())) for resource, reasons in sorted(by_reason.items())},
        "attention": sorted(attention, key=lambda item: (item["resource"], item["sourceId"])),
    }
    if include_items:
        result["items"] = sorted(items, key=lambda item: (item["resource"], item["sourceId"]))
    return result
