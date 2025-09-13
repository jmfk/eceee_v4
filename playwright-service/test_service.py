#!/usr/bin/env python3
"""
Test script for the Playwright Website Renderer service.

This script tests all endpoints and functionality of the Flask service.
"""

import requests
import time
import json
import sys

# Service configuration
BASE_URL = "http://localhost:5000"

def test_health_check():
    """Test the health check endpoint."""
    print("Testing health check endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Health check passed: {data}")
            return True
        else:
            print(f"✗ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Health check error: {e}")
        return False

def test_api_documentation():
    """Test the API documentation endpoint."""
    print("\nTesting API documentation endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"✓ API documentation available")
            print(f"  Service: {data.get('service')}")
            print(f"  Version: {data.get('version')}")
            return True
        else:
            print(f"✗ API documentation failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ API documentation error: {e}")
        return False

def test_url_validation():
    """Test URL validation endpoint."""
    print("\nTesting URL validation...")
    
    # Test valid URL
    try:
        response = requests.post(
            f"{BASE_URL}/validate",
            json={"url": "https://www.example.com"},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            if data.get("valid"):
                print("✓ Valid URL validation passed")
            else:
                print("✗ Valid URL marked as invalid")
                return False
        else:
            print(f"✗ URL validation failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ URL validation error: {e}")
        return False
    
    # Test invalid URL (blocked domain)
    try:
        response = requests.post(
            f"{BASE_URL}/validate",
            json={"url": "http://localhost:8080"},
            timeout=10
        )
        if response.status_code == 400:
            data = response.json()
            if not data.get("valid"):
                print("✓ Invalid URL correctly blocked")
            else:
                print("✗ Invalid URL not blocked")
                return False
        else:
            print(f"✗ Invalid URL validation unexpected status: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Invalid URL validation error: {e}")
        return False
    
    return True

def test_website_rendering():
    """Test website rendering endpoint."""
    print("\nTesting website rendering...")
    
    # Test basic rendering
    try:
        print("Rendering https://www.example.com...")
        start_time = time.time()
        
        response = requests.post(
            f"{BASE_URL}/render",
            json={
                "url": "https://www.example.com",
                "viewport_width": 1280,
                "viewport_height": 720,
                "full_page": False
            },
            timeout=60  # Longer timeout for rendering
        )
        
        end_time = time.time()
        duration = end_time - start_time
        
        if response.status_code == 200:
            # Check if response is PNG
            content_type = response.headers.get('content-type')
            if content_type == 'image/png':
                size = len(response.content)
                print(f"✓ Website rendered successfully")
                print(f"  Duration: {duration:.2f} seconds")
                print(f"  Image size: {size:,} bytes")
                
                # Optionally save the image
                with open('/tmp/test_screenshot.png', 'wb') as f:
                    f.write(response.content)
                print(f"  Screenshot saved to: /tmp/test_screenshot.png")
                
                return True
            else:
                print(f"✗ Unexpected content type: {content_type}")
                return False
        else:
            print(f"✗ Website rendering failed: {response.status_code}")
            if response.headers.get('content-type') == 'application/json':
                error_data = response.json()
                print(f"  Error: {error_data.get('error')}")
            return False
            
    except Exception as e:
        print(f"✗ Website rendering error: {e}")
        return False

def test_error_handling():
    """Test error handling for various scenarios."""
    print("\nTesting error handling...")
    
    # Test missing URL
    try:
        response = requests.post(f"{BASE_URL}/render", json={}, timeout=10)
        if response.status_code == 400:
            print("✓ Missing URL error handled correctly")
        else:
            print(f"✗ Missing URL error not handled: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Missing URL test error: {e}")
        return False
    
    # Test invalid JSON
    try:
        response = requests.post(
            f"{BASE_URL}/render",
            data="invalid json",
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        if response.status_code == 400:
            print("✓ Invalid JSON error handled correctly")
        else:
            print(f"✗ Invalid JSON error not handled: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Invalid JSON test error: {e}")
        return False
    
    return True

def main():
    """Run all tests."""
    print("Playwright Website Renderer Service Test Suite")
    print("=" * 50)
    
    tests = [
        test_health_check,
        test_api_documentation,
        test_url_validation,
        test_website_rendering,
        test_error_handling
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            if test():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"✗ Test {test.__name__} crashed: {e}")
            failed += 1
    
    print("\n" + "=" * 50)
    print(f"Test Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("🎉 All tests passed!")
        return 0
    else:
        print("❌ Some tests failed!")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
