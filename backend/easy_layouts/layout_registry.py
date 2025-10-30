"""
Default Layout Classes for the Web Page Publishing System

This module contains the default layouts that ship with easy_v4.
These layouts can be disabled by removing 'easy_layouts' from INSTALLED_APPS,
or completely replaced by creating custom layout apps.

All layout implementations have been moved to the layouts/ submodule for better organization.
"""

# Import all layouts from the submodule
from .layouts import *
