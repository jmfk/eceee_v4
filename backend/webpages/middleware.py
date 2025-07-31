"""
Middleware for dynamic host validation using database hostnames.
"""

import logging
from django.core.cache import cache
from django.http import HttpResponseBadRequest
from django.conf import settings
from django.utils.deprecation import MiddlewareMixin


logger = logging.getLogger(__name__)


class DynamicHostValidationMiddleware(MiddlewareMixin):
    """
    Middleware that validates hosts against database-registered hostnames.

    This middleware extends Django's ALLOWED_HOSTS checking by including
    hostnames registered in the WebPage model's hostnames field.
    """

    CACHE_KEY = "webpages_allowed_hosts"
    CACHE_TIMEOUT = 300  # 5 minutes

    def __init__(self, get_response=None):
        self.get_response = get_response
        super().__init__(get_response)

    def process_request(self, request):
        """
        Validate the request host against static and database hosts.
        """
        # Skip validation in DEBUG mode if desired
        if settings.DEBUG and getattr(settings, "SKIP_HOST_VALIDATION_IN_DEBUG", False):
            return None

        # Get host directly from META to bypass Django's built-in validation
        # This allows us to validate against database hostnames first
        host = self._get_host_from_request(request)

        if not host:
            logger.warning("No HTTP_HOST header in request")
            return HttpResponseBadRequest(
                "Invalid HTTP_HOST header. No host specified.",
                content_type="text/plain",
            )

        if not self.is_host_allowed(host):
            logger.warning(f"Disallowed host in request: {host}")
            return HttpResponseBadRequest(
                f"Invalid HTTP_HOST header: '{host}'. "
                "You may need to add this host to ALLOWED_HOSTS or register it in the database.",
                content_type="text/plain",
            )

        return None

    def _get_host_from_request(self, request):
        """
        Get the host from request without triggering Django's validation.

        This reimplements parts of Django's get_host() method but without
        the ALLOWED_HOSTS validation, allowing us to validate ourselves.
        """
        # Get the host from various headers (same logic as Django)
        host = request.META.get("HTTP_HOST")

        if not host:
            # Fallback to SERVER_NAME and SERVER_PORT (like Django does)
            server_name = request.META.get("SERVER_NAME")
            server_port = request.META.get("SERVER_PORT")

            if server_name:
                if server_port and server_port not in ("80", "443"):
                    host = f"{server_name}:{server_port}"
                else:
                    host = server_name

        return host

    def is_host_allowed(self, host):
        """
        Check if a host is allowed by checking both static ALLOWED_HOSTS
        and database-registered hostnames.
        """
        # Check static ALLOWED_HOSTS first
        if self._check_static_allowed_hosts(host):
            return True

        # Check database hostnames
        return self._check_database_hostnames(host)

    def _check_static_allowed_hosts(self, host):
        """Check against static allowed hosts setting."""
        from django.http.request import validate_host

        # Use STATIC_ALLOWED_HOSTS if available, fallback to ALLOWED_HOSTS
        static_hosts = getattr(settings, "STATIC_ALLOWED_HOSTS", settings.ALLOWED_HOSTS)
        return validate_host(host, static_hosts)

    def _check_database_hostnames(self, host):
        """Check against database-registered hostnames with caching."""
        try:
            # Try to get from cache first
            allowed_hosts = cache.get(self.CACHE_KEY)

            if allowed_hosts is None:
                allowed_hosts = self._load_database_hostnames()
                cache.set(self.CACHE_KEY, allowed_hosts, self.CACHE_TIMEOUT)

            # Normalize host for comparison
            from webpages.models import WebPage

            normalized_host = WebPage.normalize_hostname(host)

            # Check if host matches any database hostname
            for db_host in allowed_hosts:
                if db_host == "*":  # Wildcard match
                    return True
                if normalized_host == db_host:
                    return True

            return False

        except Exception as e:
            # If database is not available or has errors, log and allow
            # This prevents middleware from breaking the site
            logger.error(f"Error checking database hostnames: {e}")
            return False

    def _load_database_hostnames(self):
        """Load hostnames from the database."""
        try:
            from webpages.models import WebPage

            return WebPage.get_all_hostnames()
        except Exception as e:
            logger.error(f"Error loading hostnames from database: {e}")
            return []

    @classmethod
    def clear_hostname_cache(cls):
        """Clear the hostname cache. Call this when hostnames are updated."""
        cache.delete(cls.CACHE_KEY)
        logger.info("Cleared hostname cache")


def get_dynamic_allowed_hosts():
    """
    Get combined ALLOWED_HOSTS including static hosts and database hostnames.

    This function can be used in settings or other places where you need
    the complete list of allowed hosts.

    Returns:
        list: Combined list of static and database hostnames
    """
    # Get static hosts (use STATIC_ALLOWED_HOSTS if available)
    static_hosts = getattr(
        settings, "STATIC_ALLOWED_HOSTS", getattr(settings, "ALLOWED_HOSTS", [])
    )

    # Get database hosts with caching
    cache_key = DynamicHostValidationMiddleware.CACHE_KEY
    db_hosts = cache.get(cache_key)

    if db_hosts is None:
        try:
            from webpages.models import WebPage

            db_hosts = WebPage.get_all_hostnames()
            cache.set(
                cache_key, db_hosts, DynamicHostValidationMiddleware.CACHE_TIMEOUT
            )
        except Exception as e:
            logger.error(f"Error loading database hostnames: {e}")
            db_hosts = []

    # Combine and deduplicate
    all_hosts = list(static_hosts)
    for host in db_hosts:
        if host not in all_hosts:
            all_hosts.append(host)

    return all_hosts


class HostnameUpdateMixin:
    """
    Mixin for WebPage admin/views to automatically clear hostname cache
    when hostnames are updated.
    """

    def save_model(self, request, obj, form, change):
        """Clear hostname cache when WebPage hostnames are updated."""
        super().save_model(request, obj, form, change)

        # Check if hostnames field was changed
        if hasattr(obj, "hostnames") and obj.hostnames:
            DynamicHostValidationMiddleware.clear_hostname_cache()

    def delete_model(self, request, obj):
        """Clear hostname cache when WebPage with hostnames is deleted."""
        super().delete_model(request, obj)

        if hasattr(obj, "hostnames") and obj.hostnames:
            DynamicHostValidationMiddleware.clear_hostname_cache()
