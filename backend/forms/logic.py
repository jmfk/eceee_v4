import re

def evaluate_condition(condition, data):
    """
    Evaluates a single condition against the data.
    Condition format: { "field": "field_name", "operator": "==", "value": "some_value" }
    Supported operators: ==, !=, >, <, >=, <=, contains, regex
    """
    field = condition.get("field")
    operator = condition.get("operator", "==")
    target_value = condition.get("value")
    
    if field not in data:
        return False
    
    actual_value = data.get(field)
    
    if operator == "==":
        return str(actual_value) == str(target_value)
    elif operator == "!=":
        return str(actual_value) != str(target_value)
    elif operator == ">":
        try:
            return float(actual_value) > float(target_value)
        except (ValueError, TypeError):
            return False
    elif operator == "<":
        try:
            return float(actual_value) < float(target_value)
        except (ValueError, TypeError):
            return False
    elif operator == ">=":
        try:
            return float(actual_value) >= float(target_value)
        except (ValueError, TypeError):
            return False
    elif operator == "<=":
        try:
            return float(actual_value) <= float(target_value)
        except (ValueError, TypeError):
            return False
    elif operator == "contains":
        return str(target_value) in str(actual_value)
    elif operator == "regex":
        try:
            return bool(re.match(str(target_value), str(actual_value)))
        except re.error:
            return False
    
    return False

def evaluate_logic_group(logic_group, data):
    """
    Evaluates a group of conditions.
    logic_group: { "type": "and"|"or", "conditions": [ condition1, condition2, ... ] }
    """
    if not logic_group or not isinstance(logic_group, dict):
        return True
    
    op_type = logic_group.get("type", "and").lower()
    conditions = logic_group.get("conditions", [])
    
    if not conditions:
        return True
    
    results = [evaluate_condition(c, data) for c in conditions]
    
    if op_type == "or":
        return any(results)
    else: # Default to AND
        return all(results)

