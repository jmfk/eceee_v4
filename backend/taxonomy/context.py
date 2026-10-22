"""Actor context for compatibility writers and explicit background import jobs."""

from contextlib import contextmanager
from contextvars import ContextVar
from functools import wraps

_actor = ContextVar("classification_actor", default=None)
_syncing = ContextVar("classification_projection", default=False)


def current_actor():
    actor = _actor.get()
    return getattr(actor, "user", actor)


@contextmanager
def actor_context(actor):
    token = _actor.set(actor)
    try:
        yield
    finally:
        _actor.reset(token)


@contextmanager
def projection_context():
    token = _syncing.set(True)
    try:
        yield
    finally:
        _syncing.reset(token)


def projecting():
    return _syncing.get()


def import_actor(method):
    @wraps(method)
    def execute(self, *args, **kwargs):
        actor = getattr(self, "user", None) or self.job.created_by
        with actor_context(actor):
            return method(self, *args, **kwargs)

    return execute


class ClassificationActorMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # DRF resolves request.user after middleware starts; retain the request,
        # not an early anonymous user, and resolve it at the actual write.
        with actor_context(request):
            return self.get_response(request)
