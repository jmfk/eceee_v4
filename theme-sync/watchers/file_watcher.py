"""
File system watcher for theme files.

Monitors theme directory for changes and triggers sync operations.
"""

import time
from pathlib import Path
from typing import Callable, Optional
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileSystemEvent


class ThemeFileHandler(FileSystemEventHandler):
    """Handler for theme file system events."""

    def __init__(
        self,
        on_change: Callable[[Path], None],
        debounce_delay: float = 0.5,
    ):
        """
        Initialize file handler.
        
        Args:
            on_change: Callback function called when file changes
            debounce_delay: Delay in seconds before triggering callback
        """
        self.on_change = on_change
        self.debounce_delay = debounce_delay
        self.pending_changes = {}
        self.last_event_time = {}

    def should_process(self, file_path: Path) -> bool:
        """Check if file should be processed."""
        return (
            file_path.suffix in [".py", ".mustache"]
            and file_path.name != "__init__.py"
            and not file_path.name.startswith(".")
            and "theme.py" in str(file_path) or file_path.suffix == ".mustache"
        )

    def on_modified(self, event: FileSystemEvent):
        """Handle file modification event."""
        if event.is_directory:
            return

        file_path = Path(event.src_path)
        
        if not self.should_process(file_path):
            return

        # Debounce: only process if no recent event for this file
        current_time = time.time()
        last_time = self.last_event_time.get(file_path, 0)
        
        if current_time - last_time < self.debounce_delay:
            return
        
        self.last_event_time[file_path] = current_time
        
        # Schedule callback after debounce delay
        time.sleep(self.debounce_delay)
        
        # Check if file still exists (might have been deleted)
        if file_path.exists():
            self.on_change(file_path)


class ThemeFileWatcher:
    """File system watcher for theme directory."""

    def __init__(
        self,
        themes_dir: Path,
        on_change: Callable[[Path], None],
        debounce_delay: float = 0.5,
    ):
        """
        Initialize file watcher.
        
        Args:
            themes_dir: Directory to watch
            on_change: Callback when file changes
            debounce_delay: Debounce delay in seconds
        """
        self.themes_dir = themes_dir
        self.observer = Observer()
        self.handler = ThemeFileHandler(on_change, debounce_delay)
        self.running = False

    def start(self):
        """Start watching for file changes."""
        if self.running:
            return
        
        self.observer.schedule(
            self.handler,
            str(self.themes_dir),
            recursive=True,
        )
        self.observer.start()
        self.running = True

    def stop(self):
        """Stop watching for file changes."""
        if not self.running:
            return
        
        self.observer.stop()
        self.observer.join()
        self.running = False

