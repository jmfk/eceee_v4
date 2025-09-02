"""
Feature Flags System for Unified Widget System Deployment

This module provides a comprehensive feature flag system to enable
phased rollout of the unified widget system with granular control
over different aspects of the system.
"""

import hashlib
import logging
from typing import Dict, Any, Optional, List
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import models
from django.utils import timezone

User = get_user_model()
logger = logging.getLogger(__name__)


class FeatureFlagManager:
    """Manages feature flags for the unified widget system."""

    # Feature flag definitions
    FLAGS = {
        "unified_widgets_enabled": {
            "description": "Enable unified widget system",
            "default": False,
            "rollout_percentage": 0,
            "user_groups": [],
            "environments": ["development", "staging"],
        },
        "unified_widget_editor": {
            "description": "Enable unified widget editor interface",
            "default": False,
            "rollout_percentage": 0,
            "user_groups": ["beta_testers"],
            "environments": ["development"],
        },
        "widget_preview_system": {
            "description": "Enable new widget preview system",
            "default": False,
            "rollout_percentage": 0,
            "user_groups": [],
            "environments": ["development", "staging"],
        },
        "unified_widget_api": {
            "description": "Enable unified widget API endpoints",
            "default": False,
            "rollout_percentage": 0,
            "user_groups": [],
            "environments": ["development", "staging", "production"],
        },
        "legacy_widget_api": {
            "description": "Keep legacy widget API endpoints available",
            "default": True,
            "rollout_percentage": 100,
            "user_groups": [],
            "environments": ["development", "staging", "production"],
        },
        "widget_inheritance_system": {
            "description": "Enable widget inheritance from parent pages",
            "default": False,
            "rollout_percentage": 0,
            "user_groups": ["advanced_users"],
            "environments": ["development"],
        },
        "slot_management_ui": {
            "description": "Enable slot management interface",
            "default": False,
            "rollout_percentage": 0,
            "user_groups": [],
            "environments": ["development"],
        },
        "widget_performance_monitoring": {
            "description": "Enable widget performance monitoring",
            "default": True,
            "rollout_percentage": 100,
            "user_groups": [],
            "environments": ["development", "staging", "production"],
        },
        "widget_migration_tools": {
            "description": "Enable widget migration management tools",
            "default": True,
            "rollout_percentage": 100,
            "user_groups": ["admin"],
            "environments": ["development", "staging", "production"],
        },
    }

    @classmethod
    def is_enabled(
        cls, flag_name: str, user: Optional[User] = None, request=None, **kwargs
    ) -> bool:
        """
        Check if a feature flag is enabled for the given context.

        Args:
            flag_name: Name of the feature flag
            user: User object (optional)
            request: HTTP request object (optional)
            **kwargs: Additional context

        Returns:
            bool: True if feature is enabled, False otherwise
        """
        # Check if flag exists
        if flag_name not in cls.FLAGS:
            logger.warning(f"Unknown feature flag: {flag_name}")
            return False

        flag_config = cls.FLAGS[flag_name]

        # Check cache first
        cache_key = cls._get_cache_key(flag_name, user)
        cached_result = cache.get(cache_key)
        if cached_result is not None:
            return cached_result

        # Environment check
        current_env = getattr(settings, "ENVIRONMENT", "development")
        if current_env not in flag_config.get("environments", []):
            result = flag_config["default"]
            cache.set(cache_key, result, 300)  # Cache for 5 minutes
            return result

        # Development environment - always use default or override
        if settings.DEBUG:
            override = getattr(settings, f"FEATURE_{flag_name.upper()}", None)
            if override is not None:
                cache.set(cache_key, override, 300)
                return override

        # User group check
        if user and cls._user_in_groups(user, flag_config.get("user_groups", [])):
            cache.set(cache_key, True, 300)
            return True

        # Rollout percentage check
        rollout_percentage = flag_config.get("rollout_percentage", 0)
        if rollout_percentage >= 100:
            cache.set(cache_key, True, 300)
            return True
        elif rollout_percentage <= 0:
            result = flag_config["default"]
            cache.set(cache_key, result, 300)
            return result

        # Calculate user hash for consistent rollout
        if user:
            user_hash = int(
                hashlib.md5(f"{flag_name}:{user.id}".encode()).hexdigest()[:8], 16
            )
            user_percentage = user_hash % 100
            result = user_percentage < rollout_percentage
        else:
            result = flag_config["default"]

        cache.set(cache_key, result, 300)
        return result

    @classmethod
    def _get_cache_key(cls, flag_name: str, user: Optional[User]) -> str:
        """Generate cache key for feature flag result."""
        user_id = user.id if user else "anonymous"
        return f"feature_flag:{flag_name}:{user_id}"

    @classmethod
    def _user_in_groups(cls, user: User, groups: List[str]) -> bool:
        """Check if user is in any of the specified groups."""
        if not groups:
            return False

        # Check user groups
        user_groups = user.groups.values_list("name", flat=True)
        if any(group in user_groups for group in groups):
            return True

        # Check user attributes
        for group in groups:
            if group == "admin" and user.is_superuser:
                return True
            elif group == "staff" and user.is_staff:
                return True
            elif (
                group == "beta_testers"
                and hasattr(user, "is_beta_tester")
                and user.is_beta_tester
            ):
                return True
            elif (
                group == "advanced_users"
                and hasattr(user, "is_advanced_user")
                and user.is_advanced_user
            ):
                return True

        return False

    @classmethod
    def get_enabled_flags(cls, user: Optional[User] = None) -> Dict[str, bool]:
        """Get all enabled flags for a user."""
        return {
            flag_name: cls.is_enabled(flag_name, user) for flag_name in cls.FLAGS.keys()
        }

    @classmethod
    def clear_cache(cls, flag_name: str = None, user: Optional[User] = None) -> None:
        """Clear feature flag cache."""
        if flag_name and user:
            cache_key = cls._get_cache_key(flag_name, user)
            cache.delete(cache_key)
        elif flag_name:
            # Clear all user caches for this flag
            cache.delete_many(
                [
                    cls._get_cache_key(flag_name, None),
                    # Note: In production, you might want to use cache patterns
                ]
            )
        else:
            # Clear all feature flag caches
            cache.clear()


# Convenience functions for common feature flags
def is_unified_widgets_enabled(user: Optional[User] = None) -> bool:
    """Check if unified widget system is enabled."""
    return FeatureFlagManager.is_enabled("unified_widgets_enabled", user)


def is_unified_widget_editor_enabled(user: Optional[User] = None) -> bool:
    """Check if unified widget editor is enabled."""
    return FeatureFlagManager.is_enabled("unified_widget_editor", user)


def is_widget_preview_system_enabled(user: Optional[User] = None) -> bool:
    """Check if widget preview system is enabled."""
    return FeatureFlagManager.is_enabled("widget_preview_system", user)


def is_unified_widget_api_enabled(user: Optional[User] = None) -> bool:
    """Check if unified widget API is enabled."""
    return FeatureFlagManager.is_enabled("unified_widget_api", user)


def is_legacy_widget_api_enabled(user: Optional[User] = None) -> bool:
    """Check if legacy widget API should remain available."""
    return FeatureFlagManager.is_enabled("legacy_widget_api", user)


def is_widget_inheritance_enabled(user: Optional[User] = None) -> bool:
    """Check if widget inheritance system is enabled."""
    return FeatureFlagManager.is_enabled("widget_inheritance_system", user)


def is_slot_management_enabled(user: Optional[User] = None) -> bool:
    """Check if slot management UI is enabled."""
    return FeatureFlagManager.is_enabled("slot_management_ui", user)


def is_widget_performance_monitoring_enabled(user: Optional[User] = None) -> bool:
    """Check if widget performance monitoring is enabled."""
    return FeatureFlagManager.is_enabled("widget_performance_monitoring", user)


def is_widget_migration_tools_enabled(user: Optional[User] = None) -> bool:
    """Check if widget migration tools are enabled."""
    return FeatureFlagManager.is_enabled("widget_migration_tools", user)


# Deployment phase helpers
class DeploymentPhase:
    """Helper class to manage deployment phases."""

    PHASES = {
        "phase_0_development": {
            "description": "Development phase - all features enabled for development",
            "flags": {
                "unified_widgets_enabled": True,
                "unified_widget_editor": True,
                "widget_preview_system": True,
                "unified_widget_api": True,
                "legacy_widget_api": True,
                "widget_inheritance_system": True,
                "slot_management_ui": True,
                "widget_performance_monitoring": True,
                "widget_migration_tools": True,
            },
        },
        "phase_1_backend_rollout": {
            "description": "Phase 1: Backend changes with compatibility layer",
            "flags": {
                "unified_widgets_enabled": False,  # UI still disabled
                "unified_widget_editor": False,
                "widget_preview_system": False,
                "unified_widget_api": True,  # New API available
                "legacy_widget_api": True,  # Keep old API
                "widget_inheritance_system": False,
                "slot_management_ui": False,
                "widget_performance_monitoring": True,
                "widget_migration_tools": True,
            },
        },
        "phase_2_frontend_deployment": {
            "description": "Phase 2: Frontend components with feature flags",
            "flags": {
                "unified_widgets_enabled": True,  # Enable for beta users
                "unified_widget_editor": True,
                "widget_preview_system": True,
                "unified_widget_api": True,
                "legacy_widget_api": True,  # Still keep old API
                "widget_inheritance_system": False,  # Advanced feature - later
                "slot_management_ui": True,
                "widget_performance_monitoring": True,
                "widget_migration_tools": True,
            },
        },
        "phase_3_gradual_rollout": {
            "description": "Phase 3: Gradual user rollout",
            "flags": {
                "unified_widgets_enabled": True,  # Rollout to percentage of users
                "unified_widget_editor": True,
                "widget_preview_system": True,
                "unified_widget_api": True,
                "legacy_widget_api": True,  # Still available
                "widget_inheritance_system": True,  # Enable advanced features
                "slot_management_ui": True,
                "widget_performance_monitoring": True,
                "widget_migration_tools": True,
            },
        },
        "phase_4_full_rollout": {
            "description": "Phase 4: Full rollout to all users",
            "flags": {
                "unified_widgets_enabled": True,
                "unified_widget_editor": True,
                "widget_preview_system": True,
                "unified_widget_api": True,
                "legacy_widget_api": True,  # Keep during transition
                "widget_inheritance_system": True,
                "slot_management_ui": True,
                "widget_performance_monitoring": True,
                "widget_migration_tools": True,
            },
        },
        "phase_5_legacy_deprecation": {
            "description": "Phase 5: Deprecate legacy system",
            "flags": {
                "unified_widgets_enabled": True,
                "unified_widget_editor": True,
                "widget_preview_system": True,
                "unified_widget_api": True,
                "legacy_widget_api": False,  # Disable legacy API
                "widget_inheritance_system": True,
                "slot_management_ui": True,
                "widget_performance_monitoring": True,
                "widget_migration_tools": True,
            },
        },
    }

    @classmethod
    def apply_phase(cls, phase_name: str) -> None:
        """Apply a deployment phase configuration."""
        if phase_name not in cls.PHASES:
            raise ValueError(f"Unknown deployment phase: {phase_name}")

        phase_config = cls.PHASES[phase_name]

        # Update feature flag configurations
        for flag_name, enabled in phase_config["flags"].items():
            if flag_name in FeatureFlagManager.FLAGS:
                FeatureFlagManager.FLAGS[flag_name]["default"] = enabled
                if enabled:
                    FeatureFlagManager.FLAGS[flag_name]["rollout_percentage"] = 100
                else:
                    FeatureFlagManager.FLAGS[flag_name]["rollout_percentage"] = 0

        # Clear cache to apply changes
        FeatureFlagManager.clear_cache()

        logger.info(
            f"Applied deployment phase: {phase_name} - {phase_config['description']}"
        )

    @classmethod
    def get_current_phase(cls) -> str:
        """Determine current deployment phase based on flag states."""
        current_flags = {
            flag_name: FeatureFlagManager.FLAGS[flag_name]["default"]
            for flag_name in FeatureFlagManager.FLAGS.keys()
        }

        # Find matching phase
        for phase_name, phase_config in cls.PHASES.items():
            if current_flags == phase_config["flags"]:
                return phase_name

        return "custom_configuration"


# Django management command integration
class FeatureFlagCommand:
    """Helper for Django management commands."""

    @staticmethod
    def add_arguments(parser):
        """Add feature flag arguments to management command parser."""
        parser.add_argument(
            "--enable-flag", action="append", help="Enable specific feature flag"
        )

        parser.add_argument(
            "--disable-flag", action="append", help="Disable specific feature flag"
        )

        parser.add_argument(
            "--deployment-phase",
            choices=DeploymentPhase.PHASES.keys(),
            help="Apply deployment phase configuration",
        )

        parser.add_argument(
            "--rollout-percentage",
            nargs=2,
            metavar=("FLAG", "PERCENTAGE"),
            action="append",
            help="Set rollout percentage for flag",
        )

    @staticmethod
    def handle_flags(options):
        """Handle feature flag options from management command."""
        # Apply deployment phase
        if options.get("deployment_phase"):
            DeploymentPhase.apply_phase(options["deployment_phase"])

        # Enable flags
        if options.get("enable_flag"):
            for flag_name in options["enable_flag"]:
                if flag_name in FeatureFlagManager.FLAGS:
                    FeatureFlagManager.FLAGS[flag_name]["default"] = True
                    FeatureFlagManager.FLAGS[flag_name]["rollout_percentage"] = 100
                    print(f"✅ Enabled flag: {flag_name}")

        # Disable flags
        if options.get("disable_flag"):
            for flag_name in options["disable_flag"]:
                if flag_name in FeatureFlagManager.FLAGS:
                    FeatureFlagManager.FLAGS[flag_name]["default"] = False
                    FeatureFlagManager.FLAGS[flag_name]["rollout_percentage"] = 0
                    print(f"❌ Disabled flag: {flag_name}")

        # Set rollout percentages
        if options.get("rollout_percentage"):
            for flag_name, percentage in options["rollout_percentage"]:
                if flag_name in FeatureFlagManager.FLAGS:
                    try:
                        pct = int(percentage)
                        if 0 <= pct <= 100:
                            FeatureFlagManager.FLAGS[flag_name][
                                "rollout_percentage"
                            ] = pct
                            print(f"📊 Set {flag_name} rollout to {pct}%")
                        else:
                            print(
                                f"❌ Invalid percentage for {flag_name}: {percentage}"
                            )
                    except ValueError:
                        print(f"❌ Invalid percentage for {flag_name}: {percentage}")

        # Clear cache after changes
        FeatureFlagManager.clear_cache()
