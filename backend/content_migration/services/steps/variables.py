from .base import BaseStep
from typing import Any, Dict, Optional

class ExtractVariablesStep(BaseStep):
    def execute(self, context: Dict[str, Any], config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Extracts variables from source data using mapping.
        config: {"mapping": {"var_name": "source_field.path"}}
        """
        mapping = config.get("mapping", {})
        source = context.get("source", {})
        variables = context.get("variables", {})
        
        for var_name, source_path in mapping.items():
            # Simple path resolution
            parts = source_path.split(".")
            val = source
            for part in parts:
                if isinstance(val, dict):
                    val = val.get(part)
                else:
                    val = None
                    break
            variables[var_name] = val
            
        context["variables"] = variables
        return context

