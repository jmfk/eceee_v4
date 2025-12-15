"""
Configuration management for theme sync service.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Backend API configuration
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")
API_BASE_URL = f"{BACKEND_URL}/api/v1"

# Sync configuration
SYNC_INTERVAL = int(os.getenv("SYNC_INTERVAL", "5"))  # seconds
DEBOUNCE_DELAY = float(os.getenv("DEBOUNCE_DELAY", "0.5"))  # seconds

# Local theme directory
THEMES_DIR = Path(os.getenv("THEMES_DIR", "/themes"))
TENANT_ID = os.getenv("TENANT_ID", None)  # Required - tenant identifier
if not TENANT_ID:
    raise ValueError("TENANT_ID environment variable is required")
SYNC_STATE_FILE = THEMES_DIR / TENANT_ID / ".sync_state.json"

# API authentication (if needed)
API_TOKEN = os.getenv("API_TOKEN", None)
API_USERNAME = os.getenv("API_USERNAME", None)
API_PASSWORD = os.getenv("API_PASSWORD", None)
