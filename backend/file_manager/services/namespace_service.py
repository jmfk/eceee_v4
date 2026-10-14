"""
Service for handling namespace resolution and access control.
"""

import logging
from dataclasses import dataclass
from typing import Optional, Union

from rest_framework.response import Response

from content.models import Namespace

from ..security import SecurityAuditLogger, user_can_access_namespace

logger = logging.getLogger(__name__)


@dataclass
class NamespaceResult:
    """Data class to hold the result of a namespace resolution operation."""

    namespace: Optional[Namespace]
    error_response: Optional[Response]
    has_access: bool = False


class NamespaceAccessService:
    """Service class to handle namespace resolution and access control."""

    def get_and_validate_namespace(self, user, namespace_slug: str, tenant=None) -> Union[Namespace, Response]:
        """
        Get and validate access to a namespace.

        Args:
            user: The user requesting access
            namespace_slug: The slug of the namespace to access

        Returns:
            Either a Namespace object if access is granted, or a Response object with error details
        """
        try:
            # Resolve namespace
            namespace = self._resolve_namespace(namespace_slug, tenant=tenant)
            if not namespace:
                logger.warning(f"Namespace not found: {namespace_slug}")
                return Response(
                    {"error": f"Namespace '{namespace_slug}' not found"},
                    status=404,
                )

            # Check access
            if not self._has_namespace_access(user, namespace):
                SecurityAuditLogger.log_security_violation(
                    user,
                    "unauthorized_namespace_access",
                    f"Attempted access to namespace: {namespace.slug}",
                )
                return Response(
                    {"error": "Access denied to specified namespace"},
                    status=403,
                )

            return namespace

        except Exception as e:
            logger.error(f"Error validating namespace access for {namespace_slug}: {e}")
            return Response(
                {"error": "Error validating namespace access"},
                status=500,
            )

    def _resolve_namespace(self, namespace_slug: str, tenant=None) -> Optional[Namespace]:
        """
        Resolve a namespace slug to a Namespace object.

        Args:
            namespace_slug: The slug of the namespace to resolve

        Returns:
            Optional[Namespace]: The resolved namespace or None if not found
        """
        try:
            if namespace_slug == "default":
                return Namespace.get_default(tenant=tenant)
            queryset = Namespace.objects.all()
            if tenant is not None:
                queryset = queryset.filter(tenant=tenant)
            return queryset.get(slug=namespace_slug)
        except Namespace.DoesNotExist:
            return None
        except Exception as e:
            logger.error(f"Error resolving namespace {namespace_slug}: {e}")
            return None

    def _has_namespace_access(self, user, namespace: Namespace) -> bool:
        """
        Check if a user has access to a namespace.

        Args:
            user: The user requesting access
            namespace: The namespace to check access for

        Returns:
            bool: True if access is allowed, False otherwise
        """
        return user_can_access_namespace(user, namespace)

    def validate_namespace_access(self, user, namespace: Namespace) -> NamespaceResult:
        """
        Validate user access to a namespace.

        Args:
            user: The user requesting access
            namespace: The namespace to validate access for

        Returns:
            NamespaceResult containing access status and any error response
        """
        if not self._has_namespace_access(user, namespace):
            SecurityAuditLogger.log_security_violation(
                user,
                "unauthorized_namespace_access",
                f"Attempted access to namespace: {namespace.slug}",
            )
            return NamespaceResult(
                namespace=None,
                error_response=Response(
                    {"error": "Access denied to specified namespace"},
                    status=403,
                ),
                has_access=False,
            )

        return NamespaceResult(
            namespace=namespace,
            error_response=None,
            has_access=True,
        )
