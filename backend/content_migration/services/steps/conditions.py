from .base import BaseStep
from typing import Any, Dict, Optional
import re

class ConditionStep(BaseStep):
    def execute(self, context: Dict[str, Any], config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Checks a condition against variables.
        config: {"variable": "name", "operator": "==", "value": "xyz"}
        """
        var_name = config.get("variable")
        operator = config.get("operator", "==")
        check_val = config.get("value")
        
        variables = context.get("variables", {})
        actual_val = variables.get(var_name)
        
        if self._compare(actual_val, operator, check_val):
            return context
        return None

    def _compare(self, val1: Any, operator: str, val2: Any) -> bool:
        try:
            if operator == "==": return val1 == val2
            if operator == "!=": return val1 != val2
            if operator == ">": return val1 > val2
            if operator == "<": return val1 < val2
            if operator == "contains": return val2 in val1 if hasattr(val1, "__contains__") else False
            if operator == "regex": return bool(re.search(str(val2), str(val1)))
        except:
            return False
        return False

