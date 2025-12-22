import re
from typing import Any, Dict, List, Optional, Union


class WorkflowEngine:
    """
    Executes a sequence of actions on a data item or list of items.
    """

    def execute(
        self,
        data: Union[List[Dict[str, Any]], Dict[str, Any]],
        workflow: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        if not workflow:
            return data if isinstance(data, list) else [data]

        items = data if isinstance(data, list) else [data]
        processed_items = []

        for item in items:
            current_item = item.copy()
            skip_item = False

            for action in workflow:
                action_type = action.get("type")
                config = action.get("config", {})

                result = self.handle_action(action_type, current_item, config)

                if result is None:  # Action indicated to skip/filter out
                    skip_item = True
                    break

                current_item = result

            if not skip_item:
                processed_items.append(current_item)

        return processed_items

    def handle_action(
        self, action_type: str, item: Dict[str, Any], config: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        handler_map = {
            "find_unique_id": self._action_find_unique_id,
            "translate_field": self._action_translate_field,
            "convert_type": self._action_convert_type,
            "count_items": self._action_count_items,
            "check_value": self._action_check_value,
            "filter_expression": self._action_filter_expression,
        }

        handler = handler_map.get(action_type)
        if not handler:
            return item

        return handler(item, config)

    def _action_find_unique_id(
        self, item: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Ensures a unique ID exists.
        config: {"source_fields": ["id", "slug", "name"], "target_field": "uid"}
        """
        source_fields = config.get("source_fields", ["id"])
        target_field = config.get("target_field", "uid")

        for field in source_fields:
            val = item.get(field)
            if val:
                item[target_field] = str(val)
                return item

        # Fallback to hash of entire item if no id found
        import hashlib
        import json

        item_hash = hashlib.md5(json.dumps(item, sort_keys=True).encode()).hexdigest()
        item[target_field] = item_hash
        return item

    def _action_translate_field(
        self, item: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Renames or maps fields.
        config: {"mapping": {"new_name": "old_name"}}
        """
        mapping = config.get("mapping", {})
        for target, source in mapping.items():
            if source in item:
                item[target] = item.pop(source)
        return item

    def _action_convert_type(
        self, item: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Converts a field type.
        config: {"field": "count", "to": "int"}
        """
        field = config.get("field")
        to_type = config.get("to")

        if not field or field not in item:
            return item

        val = item[field]
        try:
            if to_type == "int":
                item[field] = int(val)
            elif to_type == "float":
                item[field] = float(val)
            elif to_type == "str":
                item[field] = str(val)
            elif to_type == "bool":
                item[field] = bool(val)
        except (ValueError, TypeError):
            pass

        return item

    def _action_count_items(
        self, item: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Counts items in a list or dict.
        config: {"field": "tags", "target_field": "tag_count"}
        """
        field = config.get("field")
        target_field = config.get("target_field")

        if not field or field not in item or not target_field:
            return item

        val = item[field]
        if isinstance(val, (list, dict)):
            item[target_field] = len(val)
        else:
            item[target_field] = 0

        return item

    def _action_check_value(
        self, item: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Adds a boolean check result to the item.
        config: {"field": "status", "operator": "==", "value": "active", "target_field": "is_active"}
        """
        field = config.get("field")
        operator = config.get("operator", "==")
        check_val = config.get("value")
        target_field = config.get("target_field")

        if not field or field not in item or not target_field:
            return item

        item_val = item[field]
        item[target_field] = self._compare(item_val, operator, check_val)
        return item

    def _action_filter_expression(
        self, item: Dict[str, Any], config: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Filters out the item if the condition is not met.
        config: {"field": "score", "operator": ">", "value": 50}
        """
        field = config.get("field")
        operator = config.get("operator", "==")
        check_val = config.get("value")

        if not field or field not in item:
            return item

        item_val = item[field]
        if self._compare(item_val, operator, check_val):
            return item
        return None

    def _compare(self, val1: Any, operator: str, val2: Any) -> bool:
        try:
            if operator == "==":
                return val1 == val2
            if operator == "!=":
                return val1 != val2
            if operator == ">":
                return val1 > val2
            if operator == "<":
                return val1 < val2
            if operator == ">=":
                return val1 >= val2
            if operator == "<=":
                return val1 <= val2
            if operator == "contains":
                return val2 in val1 if hasattr(val1, "__contains__") else False
            if operator == "regex":
                return bool(re.search(str(val2), str(val1)))
        except:
            return False
        return False
