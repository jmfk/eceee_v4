#!/usr/bin/env python
"""
Clear theme CSS cache from Redis
"""
import os
import sys
import django

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.core.cache import cache
from webpages.models import PageTheme

# Get all theme IDs
themes = PageTheme.objects.all()

print(f"Clearing CSS cache for {themes.count()} themes...")

for theme in themes:
    # Clear both scoped and non-scoped cache
    cache_key_frontend = f"theme_css_{theme.id}_frontend"
    cache_key_backend = f"theme_css_{theme.id}"
    
    cache.delete(cache_key_frontend)
    cache.delete(cache_key_backend)
    
    print(f"  ✓ Cleared cache for theme: {theme.name} (ID: {theme.id})")

print("\nCache cleared successfully!")
print("\nNext steps:")
print("1. Restart the backend server to reload widget CSS")
print("2. Clear browser cache (Ctrl+Shift+R / Cmd+Shift+R)")
print("3. Test in the frontend editor")
