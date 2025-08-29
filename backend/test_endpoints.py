#!/usr/bin/env python
"""
Test script to verify the newly implemented object storage endpoints
"""
import os
import sys
import django
from django.conf import settings

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import Client
from django.contrib.auth.models import User
from object_storage.models import ObjectTypeDefinition, ObjectInstance
import json

def test_endpoints():
    """Test the newly implemented endpoints"""
    client = Client()
    
    # Get a user for authentication
    user = User.objects.first()
    if not user:
        print("No users found in database")
        return
    
    # Force login
    client.force_login(user)
    
    print("Testing Object Storage API Endpoints")
    print("=" * 50)
    
    # Test 1: Get active object types
    print("\n1. Testing GET /api/v1/objects/api/object-types/active/")
    response = client.get('/api/v1/objects/api/object-types/active/')
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Found {len(data)} active object types")
    else:
        print(f"Error: {response.content}")
    
    # Test 2: Get objects by type (if there are any object types)
    obj_types = ObjectTypeDefinition.objects.filter(is_active=True).first()
    if obj_types:
        print(f"\n2. Testing GET /api/v1/objects/api/objects/by-type/{obj_types.name}/")
        response = client.get(f'/api/v1/objects/api/objects/by-type/{obj_types.name}/')
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Found {len(data)} objects of type '{obj_types.name}'")
        else:
            print(f"Error: {response.content}")
    else:
        print("\n2. Skipping by-type test - no object types found")
    
    # Test 3: Bulk operations (with empty list to test validation)
    print("\n3. Testing POST /api/v1/objects/api/objects/bulk-operations/")
    response = client.post(
        '/api/v1/objects/api/objects/bulk-operations/',
        data=json.dumps({'operation': 'publish', 'object_ids': []}),
        content_type='application/json'
    )
    print(f"Status: {response.status_code}")
    if response.status_code == 400:
        print("Correctly rejected empty object_ids")
    else:
        print(f"Response: {response.content}")
    
    # Test with missing operation
    response = client.post(
        '/api/v1/objects/api/objects/bulk-operations/',
        data=json.dumps({'object_ids': [1]}),
        content_type='application/json'
    )
    print(f"Missing operation status: {response.status_code}")
    
    print("\n" + "=" * 50)
    print("Endpoint testing completed!")

if __name__ == '__main__':
    test_endpoints()
