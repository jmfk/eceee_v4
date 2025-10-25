"""
Dictionary utility classes and functions.
"""


class DictToObj:
    """
    Convert a dictionary to an object with both dot notation and bracket notation access.

    Recursively converts nested dictionaries and lists containing dictionaries
    to objects with attribute access. Supports both object-like and dict-like operations.

    Example:
        >>> data = {"name": "John", "address": {"city": "NYC", "zip": "10001"}}
        >>> obj = DictToObj(data)
        >>> obj.name  # Dot notation
        'John'
        >>> obj["name"]  # Bracket notation
        'John'
        >>> obj.address.city  # Nested dot notation
        'NYC'
        >>> obj["address"]["city"]  # Nested bracket notation
        'NYC'
        >>> "name" in obj  # Membership test
        True
        >>> obj.get("age", 30)  # Get with default
        30
        >>> obj.to_dict()
        {'name': 'John', 'address': {'city': 'NYC', 'zip': '10001'}}
    """

    def __init__(self, d):
        for key, value in d.items():
            if isinstance(value, dict):
                setattr(self, key, DictToObj(value))
            elif isinstance(value, list):
                setattr(
                    self,
                    key,
                    [DictToObj(v) if isinstance(v, dict) else v for v in value],
                )
            else:
                setattr(self, key, value)

    def __repr__(self):
        return f"{self.__class__.__name__}({self.__dict__})"

    def __getitem__(self, key):
        """Support bracket notation for getting values."""
        return getattr(self, key)

    def __setitem__(self, key, value):
        """Support bracket notation for setting values."""
        if isinstance(value, dict):
            setattr(self, key, DictToObj(value))
        elif isinstance(value, list):
            setattr(
                self,
                key,
                [DictToObj(v) if isinstance(v, dict) else v for v in value],
            )
        else:
            setattr(self, key, value)

    def __contains__(self, key):
        """Support 'in' operator."""
        return hasattr(self, key)

    def get(self, key, default=None):
        """Get value with default, like dict.get()."""
        return getattr(self, key, default)

    def keys(self):
        """Return keys like a dictionary."""
        return self.__dict__.keys()

    def values(self):
        """Return values like a dictionary."""
        return self.__dict__.values()

    def items(self):
        """Return items like a dictionary."""
        return self.__dict__.items()

    def to_dict(self):
        """
        Convert the DictToObj instance back to a plain dictionary.

        Recursively converts nested DictToObj instances and lists containing
        DictToObj instances back to dictionaries.

        Returns:
            dict: A plain Python dictionary representation of the object.
        """
        result = {}
        for key, value in self.__dict__.items():
            if isinstance(value, DictToObj):
                result[key] = value.to_dict()
            elif isinstance(value, list):
                result[key] = [
                    item.to_dict() if isinstance(item, DictToObj) else item
                    for item in value
                ]
            else:
                result[key] = value
        return result
