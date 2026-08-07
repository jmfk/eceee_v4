"""
Middleware for dynamic host validation using database hostnames.

This middleware provides secure fallback behavior during database outages:
- By default, denies hosts not in STATIC_ALLOWED_HOSTS when database is unavailable
- Configurable via DATABASE_FAILURE_FALLBACK setting ('deny', 'allow', 'static_only')
- Logs all fallback decisions for security monitoring
"""

import hashlib
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

    CACHE_TIMEOUT = 300  # 5 minutes

    @classmethod
    def get_cache_key(cls):
        """
        Generate a secure, unpredictable cache key to prevent cache poisoning attacks.

        Uses application SECRET_KEY and a base identifier to create a unique hash
        that's specific to this Django instance and harder to predict.
        """
        return cls._generate_cache_key()

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
        """Check against database-registered hostnames with atomic caching."""
        try:
            # Use atomic get_or_set to prevent race conditions
            def load_hostnames():
                hostnames = self._load_database_hostnames()
                # Check if loading failed (indicated by special error marker)
                if hostnames == "_DATABASE_ERROR_":
                    raise Exception("Database error loading hostnames")
                return hostnames

            allowed_hosts = cache.get_or_set(
                self.get_cache_key(), load_hostnames, self.CACHE_TIMEOUT
            )

            # Normalize host for comparison
            from webpages.models import WebPage

            normalized_host = WebPage.normalize_hostname(host)

            # Check if host matches any database hostname
            wildcard_found = False
            for db_host in allowed_hosts:
                if db_host == "*":  # Wildcard match
                    wildcard_found = True
                    # Log wildcard usage for security monitoring
                    logger.warning(
                        f"SECURITY WARNING: Wildcard hostname (*) is active, allowing ALL hosts including '{host}'. "
                        f"This significantly reduces security. Consider using specific hostnames instead."
                    )
                    # Check if wildcard usage is explicitly allowed
                    if self._is_wildcard_allowed():
                        return True
                    else:
                        logger.error(
                            f"SECURITY BLOCK: Wildcard hostname (*) found but ALLOW_WILDCARD_HOSTNAMES=False. "
                            f"Denying host '{host}' for security."
                        )
                        continue
                if normalized_host == db_host:
                    return True

            # Additional logging if wildcard was found but blocked
            if wildcard_found:
                pass  # Wildcard was blocked, already logged above
            else:
                # Log detailed denial information for debugging
                logger.warning(
                    f"Host '{host}' (normalized: '{normalized_host}') denied. "
                    f"Available database hostnames: {allowed_hosts}. "
                    f"Static allowed hosts: {getattr(settings, 'STATIC_ALLOWED_HOSTS', [])}. "
                    f"Hint: If this should be allowed, ensure it's configured in a ROOT page's hostnames field."
                )

            return False

        except Exception as e:
            # Handle database failure with secure fallback behavior
            logger.error(f"Error checking database hostnames: {e}")
            return self._handle_database_failure_fallback(host)

    def _load_database_hostnames(self):
        """Load hostnames from the database."""
        try:
            from webpages.models import WebPage

            hostnames = WebPage.get_all_hostnames()
            logger.debug(
                f"Loaded {len(hostnames)} hostname(s) from database: {hostnames}"
            )
            return hostnames
        except Exception as e:
            logger.error(f"Error loading hostnames from database: {e}")
            return "_DATABASE_ERROR_"  # Special marker to indicate database error

    def _is_wildcard_allowed(self):
        """
        Check if wildcard hostname usage is explicitly allowed.

        Returns:
            bool: True if wildcard hostnames are allowed, False otherwise
        """
        return getattr(settings, "ALLOW_WILDCARD_HOSTNAMES", False)

    def _handle_database_failure_fallback(self, host):
        """
        Handle database failure with configurable secure fallback behavior.

        Available fallback strategies (controlled by DATABASE_FAILURE_FALLBACK setting):
        - 'deny' (default): Deny all hosts not in STATIC_ALLOWED_HOSTS (most secure)
        - 'allow': Allow all hosts (least secure, maximum availability)
        - 'static_only': Explicitly check against static hosts only (same as 'deny' but clearer)

        Returns:
            bool: Whether to allow the host during database failure
        """
        fallback_strategy = getattr(settings, "DATABASE_FAILURE_FALLBACK", "deny")

        if fallback_strategy == "allow":
            # Enhanced warning for security bypass
            logger.critical(
                f"SECURITY RISK: Database failure fallback ALLOWING host '{host}' due to "
                f"DATABASE_FAILURE_FALLBACK='allow' setting. All hostname validation is bypassed! "
                f"Consider using 'static_only' for better security during outages."
            )
            return True
        elif fallback_strategy == "static_only":
            # Explicitly check against static hosts
            result = self._check_static_allowed_hosts(host)
            logger.warning(
                f"Database failure fallback: {'ALLOWING' if result else 'DENYING'} host '{host}' "
                f"based on static ALLOWED_HOSTS check only"
            )
            return result
        else:  # 'deny' or any other value
            logger.warning(
                f"Database failure fallback: DENYING host '{host}' (not in STATIC_ALLOWED_HOSTS). "
                f"Set DATABASE_FAILURE_FALLBACK='allow' to allow all hosts during outages."
            )
            return False

    @classmethod
    def _generate_cache_key(cls):
        """Generate the secure cache key. Helper method for class-level operations."""
        cache_prefix = getattr(settings, "HOSTNAME_CACHE_KEY_PREFIX", "webpages_hosts")
        key_material = f"{cache_prefix}:{settings.SECRET_KEY}:allowed_hosts"
        cache_key_hash = hashlib.sha256(key_material.encode("utf-8")).hexdigest()[:16]
        return f"dhv_{cache_key_hash}"

    @classmethod
    def clear_hostname_cache(cls):
        """Clear the hostname cache. Call this when hostnames are updated."""
        cache_key = cls._generate_cache_key()
        cache.delete(cache_key)


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
    cache_key = DynamicHostValidationMiddleware.get_cache_key()
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
