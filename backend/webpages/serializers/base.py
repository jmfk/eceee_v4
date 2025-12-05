# Copyright (C) 2025 Johan Mats Fred Karlsson
#
# This file is part of easy_v4.
#
# This program is licensed under the Server Side Public License, version 1,
# as published by MongoDB, Inc. See the LICENSE file for details.

"""
Base serializers for the Web Page Publishing System
"""

from rest_framework import serializers
from django.contrib.auth.models import User


class UserSerializer(serializers.ModelSerializer):
    """Basic user serializer for references"""

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email"]
        read_only_fields = ["id"]

