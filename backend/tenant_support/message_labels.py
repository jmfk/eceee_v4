from .models import MessageLabel


DEFAULT_LABELS = (
    ("question", "Question"),
    ("suggestion", "Suggestion"),
    ("content", "Content"),
    ("bug", "Bug Report"),
)


def ensure_message_labels(tenant):
    if MessageLabel.objects.filter(tenant=tenant).exists():
        return
    for position, (key, name) in enumerate(DEFAULT_LABELS):
        MessageLabel.objects.get_or_create(tenant=tenant, name=name, defaults={"key": key, "position": position})
