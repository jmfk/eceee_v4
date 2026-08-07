from typing import Any, Dict, Optional

class BaseStep:
    def execute(self, context: Dict[str, Any], config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Processes the context and returns updated context or None to skip.
        """
        raise NotImplementedError("Subclasses must implement execute()")

