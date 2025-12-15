"""
Theme Sync Service

Main orchestrator for bidirectional theme synchronization between local Python files
and server JSON storage.
"""

import json
import time
import logging
from pathlib import Path
from typing import Dict, Optional
import requests
from requests.auth import HTTPBasicAuth

import config
from converters.python_to_json import convert_theme_to_json
from converters.json_to_python import generate_theme_from_json
from watchers.file_watcher import ThemeFileWatcher

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


class ThemeSyncService:
    """Main theme synchronization service."""

    def __init__(self):
        """Initialize sync service."""
        self.themes_dir = config.THEMES_DIR
        self.tenant_id = config.TENANT_ID
        self.tenant_dir = self.themes_dir / self.tenant_id
        self.sync_state_file = config.SYNC_STATE_FILE

        # Ensure tenant directory exists
        self.tenant_dir.mkdir(parents=True, exist_ok=True)

        self.sync_state: Dict[str, int] = {}  # theme_name -> sync_version
        self.conflicts: Dict[str, bool] = {}  # theme_name -> has_conflict
        self.api_base = config.API_BASE_URL
        self.session = requests.Session()

        # Add tenant header to all requests
        self.session.headers.update({"X-Tenant-ID": self.tenant_id})

        # Setup authentication if provided
        auth_configured = False
        if config.API_USERNAME and config.API_PASSWORD:
            # For JWT: first get token, then use it
            try:
                token_response = self.session.post(
                    f"{self.api_base}/auth/token/",
                    json={
                        "username": config.API_USERNAME,
                        "password": config.API_PASSWORD,
                    },
                )
                if token_response.status_code == 200:
                    token_data = token_response.json()
                    access_token = token_data.get("access")
                    if access_token:
                        self.session.headers.update(
                            {"Authorization": f"Bearer {access_token}"}
                        )
                        auth_configured = True
                        logger.info("Authentication successful (JWT)")
                    else:
                        logger.error("Failed to get access token from login response")
                elif token_response.status_code == 401:
                    logger.error("Authentication failed: Invalid username or password")
                    logger.error(
                        "Please check API_USERNAME and API_PASSWORD in docker-compose.dev.yml"
                    )
                else:
                    logger.warning(
                        f"Unexpected response from auth endpoint: {token_response.status_code}"
                    )
            except Exception as e:
                logger.error(f"Failed to authenticate: {e}")
        elif config.API_TOKEN:
            # Support both JWT (Bearer) and Token auth
            if config.API_TOKEN.startswith(
                "eyJ"
            ):  # JWT tokens typically start with eyJ
                self.session.headers.update(
                    {"Authorization": f"Bearer {config.API_TOKEN}"}
                )
            else:
                self.session.headers.update(
                    {"Authorization": f"Token {config.API_TOKEN}"}
                )
            auth_configured = True
            logger.info("Using API token for authentication")
        else:
            logger.warning(
                "No authentication configured. Set API_TOKEN or API_USERNAME/API_PASSWORD"
            )
            logger.warning(
                "API requests may fail. See theme-sync/README.md for setup instructions."
            )

        # Load sync state
        self.load_sync_state()

        # Initialize file watcher
        self.file_watcher = ThemeFileWatcher(
            self.tenant_dir,
            self.on_file_change,
            debounce_delay=config.DEBOUNCE_DELAY,
        )

    def load_sync_state(self):
        """Load sync state from disk."""
        if self.sync_state_file.exists():
            try:
                with open(self.sync_state_file, "r") as f:
                    self.sync_state = json.load(f)
                logger.info(f"Loaded sync state: {len(self.sync_state)} themes")
            except Exception as e:
                logger.error(f"Error loading sync state: {e}")
                self.sync_state = {}

    def save_sync_state(self):
        """Save sync state to disk."""
        try:
            with open(self.sync_state_file, "w") as f:
                json.dump(self.sync_state, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving sync state: {e}")

    def _check_auth_error(self, response) -> bool:
        """Check if response indicates an authentication error and log appropriate message."""
        if response.status_code == 401:
            logger.error("Authentication failed: Invalid API token or credentials")
            logger.error(
                "Please check your API_TOKEN or API_USERNAME/API_PASSWORD in docker-compose.dev.yml"
            )
            return True
        elif response.status_code == 403:
            # Check if it's a CSRF error or sync disabled
            text = response.text.lower()
            if "csrf" in text:
                logger.error(
                    "Authentication failed: CSRF error (likely invalid or missing API token)"
                )
                logger.error(
                    "Please check your API_TOKEN or API_USERNAME/API_PASSWORD in docker-compose.dev.yml"
                )
                return True
            elif "theme sync is disabled" in text or "THEME_SYNC_ENABLED" in text:
                logger.error(
                    "Theme sync is disabled on server. Set THEME_SYNC_ENABLED=True"
                )
                return True
            else:
                logger.error(
                    "Access forbidden (403). Check authentication and permissions."
                )
                return True
        return False

    def check_sync_enabled(self) -> bool:
        """Check if sync is enabled on server."""
        try:
            response = self.session.get(f"{self.api_base}/webpages/themes/sync/status/")
            if self._check_auth_error(response):
                return False
            if response.status_code == 200:
                return True
            logger.error(f"Unexpected response: {response.status_code}")
            return False
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to connect to server: {e}")
            logger.error(f"Check that backend is running at {self.api_base}")
            return False
        except Exception as e:
            logger.error(f"Error checking sync status: {e}")
            return False

    def initial_sync(self):
        """Perform initial sync: pull all themes from server."""
        logger.info("Starting initial sync...")

        if not self.check_sync_enabled():
            return False

        try:
            response = self.session.post(f"{self.api_base}/webpages/themes/sync/pull/")
            if self._check_auth_error(response):
                return False
            if response.status_code != 200:
                logger.error(f"Failed to pull themes: HTTP {response.status_code}")
                try:
                    error_data = response.json()
                    if "error" in error_data:
                        logger.error(f"Error: {error_data['error']}")
                except:
                    pass
                return False

            data = response.json()
            themes = data.get("themes", [])
            max_version = data.get("max_version", 0)

            logger.info(f"Pulled {len(themes)} themes from server")

            # Organize themes by category (base vs custom)
            all_themes = {theme["name"]: theme for theme in themes}

            for theme in themes:
                theme_name = theme["name"]

                # Determine directory (base or custom) under tenant
                # Simple heuristic: if name contains "dark" or "light", it's custom
                if any(
                    word in theme_name.lower() for word in ["dark", "light", "custom"]
                ):
                    theme_dir = (
                        self.tenant_dir
                        / "custom"
                        / theme_name.lower().replace(" ", "_")
                    )
                else:
                    theme_dir = (
                        self.tenant_dir / "base" / theme_name.lower().replace(" ", "_")
                    )

                # Generate Python files
                generate_theme_from_json(theme, theme_dir, all_themes)

                # Update sync state
                self.sync_state[theme_name] = theme.get("sync_version", 1)
                logger.info(f"Generated theme: {theme_name} at {theme_dir}")

            self.save_sync_state()
            logger.info("Initial sync completed")
            return True

        except Exception as e:
            logger.error(f"Error during initial sync: {e}")
            return False

    def on_file_change(self, file_path: Path):
        """Handle file change event."""
        # Skip if conflict file
        if ".conflict" in file_path.name:
            return

        # Find theme directory (parent of theme.py or parent of component_styles/image_styles)
        theme_dir = file_path.parent
        while theme_dir != self.tenant_dir and not (theme_dir / "theme.py").exists():
            if theme_dir.parent == theme_dir:  # Reached root
                break
            theme_dir = theme_dir.parent

        theme_file = theme_dir / "theme.py"
        if not theme_file.exists():
            logger.warning(f"Theme file not found for {file_path}")
            return

        theme_name = self.get_theme_name_from_file(theme_file)
        if not theme_name:
            logger.warning(f"Could not determine theme name from {theme_file}")
            return

        # Check for conflicts
        if self.conflicts.get(theme_name, False):
            logger.warning(f"Skipping sync for {theme_name} - conflict not resolved")
            return

        logger.info(f"File changed: {file_path}, syncing theme: {theme_name}")
        self.push_theme(theme_file, theme_name)

    def get_theme_name_from_file(self, theme_file: Path) -> Optional[str]:
        """Extract theme name from Python file."""
        try:
            # Quick parse: look for name = "..."
            content = theme_file.read_text(encoding="utf-8")
            for line in content.split("\n"):
                if line.strip().startswith("name ="):
                    # Extract string value
                    name = line.split("=", 1)[1].strip().strip('"').strip("'")
                    return name
        except Exception as e:
            logger.error(f"Error reading theme file {theme_file}: {e}")
        return None

    def push_theme(self, theme_file: Path, theme_name: str):
        """Push theme to server."""
        try:
            # Convert Python to JSON
            theme_data = convert_theme_to_json(theme_file)

            # Get current version
            client_version = self.sync_state.get(theme_name, 1)

            # Prepare push request
            push_data = {
                "sync_version": client_version,
                "theme_data": theme_data,
            }

            response = self.session.post(
                f"{self.api_base}/webpages/themes/sync/push/",
                json=push_data,
            )

            if self._check_auth_error(response):
                return

            if response.status_code == 409:
                # Conflict detected
                error_data = response.json()
                server_version = error_data.get("server_version", 0)
                logger.error(
                    f"Version conflict for {theme_name}: "
                    f"client={client_version}, server={server_version}"
                )
                self.handle_conflict(
                    theme_file, theme_name, client_version, server_version
                )
                self.conflicts[theme_name] = True
                return

            if self._check_auth_error(response):
                return
            if response.status_code not in [200, 201]:
                logger.error(
                    f"Failed to push theme {theme_name}: HTTP {response.status_code}"
                )
                try:
                    error_data = response.json()
                    if "error" in error_data:
                        logger.error(f"Error: {error_data['error']}")
                except:
                    pass
                return

            # Update sync state
            updated_theme = response.json()
            self.sync_state[theme_name] = updated_theme.get(
                "sync_version", client_version + 1
            )
            self.save_sync_state()
            self.conflicts[theme_name] = False

            logger.info(
                f"Successfully pushed theme: {theme_name} (version {self.sync_state[theme_name]})"
            )

        except Exception as e:
            logger.error(f"Error pushing theme {theme_name}: {e}")

    def handle_conflict(
        self,
        theme_file: Path,
        theme_name: str,
        client_version: int,
        server_version: int,
    ):
        """Handle version conflict."""
        conflict_file = theme_file.parent / f"{theme_file.name}.conflict"

        conflict_info = {
            "theme_name": theme_name,
            "client_version": client_version,
            "server_version": server_version,
            "message": (
                f"Version conflict detected. Client version ({client_version}) "
                f"is older than server version ({server_version}). "
                "Please pull latest changes, manually merge, and remove this file."
            ),
        }

        conflict_file.write_text(json.dumps(conflict_info, indent=2), encoding="utf-8")
        logger.error(f"Conflict file created: {conflict_file}")

    def poll_server(self):
        """Poll server for theme updates."""
        if not self.check_sync_enabled():
            return

        try:
            # Get max version we've seen
            max_seen_version = max(self.sync_state.values()) if self.sync_state else 0

            response = self.session.get(
                f"{self.api_base}/webpages/themes/sync/status/",
                params={"since_version": max_seen_version},
            )

            if self._check_auth_error(response):
                return
            if response.status_code != 200:
                return

            data = response.json()
            themes = data.get("themes", [])

            if not themes:
                return

            logger.info(f"Received {len(themes)} theme updates from server")

            # Get all themes for inheritance detection
            all_themes = {}
            try:
                all_response = self.session.post(
                    f"{self.api_base}/webpages/themes/sync/pull/"
                )
                if self._check_auth_error(all_response):
                    return
                if all_response.status_code == 200:
                    all_themes_data = all_response.json()
                    all_themes = {
                        t["name"]: t for t in all_themes_data.get("themes", [])
                    }
            except Exception:
                # Fallback to just the updated themes
                all_themes = {t["name"]: t for t in themes}

            # Update local files
            for theme in themes:
                theme_name = theme["name"]
                server_version = theme.get("sync_version", 1)

                # Skip if we have a newer or equal version
                if self.sync_state.get(theme_name, 0) >= server_version:
                    continue

                # Determine directory
                if any(
                    word in theme_name.lower() for word in ["dark", "light", "custom"]
                ):
                    theme_dir = (
                        self.themes_dir
                        / "custom"
                        / theme_name.lower().replace(" ", "_")
                    )
                else:
                    theme_dir = (
                        self.themes_dir / "base" / theme_name.lower().replace(" ", "_")
                    )

                # Generate Python files
                generate_theme_from_json(theme, theme_dir, all_themes)

                # Update sync state
                self.sync_state[theme_name] = server_version
                logger.info(
                    f"Updated theme from server: {theme_name} (version {server_version})"
                )

            self.save_sync_state()

        except Exception as e:
            logger.error(f"Error polling server: {e}")

    def run(self):
        """Run sync service."""
        logger.info("Starting theme sync service...")

        # Perform initial sync
        if not self.initial_sync():
            logger.error("Initial sync failed. Exiting.")
            return

        # Start file watcher
        self.file_watcher.start()
        logger.info(f"Watching for file changes in {self.tenant_dir}")

        try:
            # Main loop: poll server periodically
            while True:
                time.sleep(config.SYNC_INTERVAL)
                self.poll_server()
        except KeyboardInterrupt:
            logger.info("Stopping sync service...")
        finally:
            self.file_watcher.stop()
            logger.info("Sync service stopped")


if __name__ == "__main__":
    service = ThemeSyncService()
    service.run()
