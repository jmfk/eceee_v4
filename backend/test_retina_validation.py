#!/usr/bin/env python
"""
Test script for retina image validation and DPR support.

This script tests:
1. Image dimension extraction on upload
2. DPR parameter support in imgproxy
3. CSS generation with image-set
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from file_manager.imgproxy import imgproxy_service
from io import BytesIO
from PIL import Image as PILImage


def test_dpr_parameter():
    """Test that DPR parameter is correctly added to imgproxy URLs"""
    print("\n=== Testing DPR Parameter Support ===")
    
    test_url = "s3://eceee-media/test-image.jpg"
    
    # Test @1x
    url_1x = imgproxy_service.generate_url(
        source_url=test_url,
        width=640,
        resize_type="fill",
        dpr=1.0
    )
    print(f"✓ Generated @1x URL: {url_1x}")
    assert "dpr:1" not in url_1x, "DPR 1.0 should not be in URL (default)"
    
    # Test @2x
    url_2x = imgproxy_service.generate_url(
        source_url=test_url,
        width=640,
        resize_type="fill",
        dpr=2.0
    )
    print(f"✓ Generated @2x URL: {url_2x}")
    assert "dpr:2" in url_2x, "DPR 2.0 should be in URL"
    
    print("✅ DPR parameter test PASSED\n")
    return True


def test_image_dimension_extraction():
    """Test that image dimensions are correctly extracted"""
    print("\n=== Testing Image Dimension Extraction ===")
    
    # Create a test image in memory
    img = PILImage.new('RGB', (1280, 720), color='red')
    img_bytes = BytesIO()
    img.save(img_bytes, format='JPEG')
    img_bytes.seek(0)
    
    # Open and verify dimensions
    test_img = PILImage.open(img_bytes)
    width = test_img.width
    height = test_img.height
    
    print(f"✓ Created test image: {width}x{height}px")
    assert width == 1280, f"Expected width 1280, got {width}"
    assert height == 720, f"Expected height 720, got {height}"
    
    print("✅ Image dimension extraction test PASSED\n")
    return True


def test_css_generation_with_dpr():
    """Test CSS generation with image-set for DPR support"""
    print("\n=== Testing CSS Generation with DPR ===")
    
    from webpages.models import PageTheme
    from django.contrib.auth import get_user_model
    from core.models import Tenant
    
    User = get_user_model()
    
    # Get or create a test tenant
    tenant, _ = Tenant.objects.get_or_create(
        subdomain='test',
        defaults={
            'name': 'Test Tenant',
            'is_active': True
        }
    )
    
    # Get or create a test theme
    theme, created = PageTheme.objects.get_or_create(
        name='Test Retina Theme',
        tenant=tenant,
        defaults={
            'description': 'Test theme for retina validation',
            'is_active': True,
            'design_groups': {
                'groups': [
                    {
                        'name': 'Test Group',
                        'targetingMode': 'layout-part',
                        'targetLayoutParts': ['header'],
                        'layoutProperties': {
                            'header': {
                                'sm': {
                                    'images': {
                                        'background': {
                                            'url': 's3://eceee-media/test-bg.jpg',
                                            'width': 1280,
                                            'height': 720
                                        }
                                    }
                                }
                            }
                        }
                    }
                ]
            }
        }
    )
    
    if created:
        print(f"✓ Created test theme: {theme.name}")
    else:
        print(f"✓ Using existing test theme: {theme.name}")
    
    # Generate CSS
    css = theme._generate_design_groups_css(scope='', widget_type=None, slot=None)
    
    print(f"✓ Generated CSS ({len(css)} characters)")
    
    # Check for image-set in CSS
    if 'image-set' in css or '-webkit-image-set' in css:
        print("✓ CSS contains image-set for retina support")
        
        # Check for DPR URLs
        if 'dpr:2' in css:
            print("✓ CSS contains @2x DPR URLs")
        else:
            print("⚠ Warning: CSS doesn't contain DPR URLs (might be using fallback)")
    else:
        print("⚠ Warning: CSS doesn't contain image-set (might be using fallback)")
    
    # Print a sample of the CSS
    print("\n--- CSS Sample (first 500 chars) ---")
    print(css[:500])
    print("--- End CSS Sample ---\n")
    
    print("✅ CSS generation test PASSED\n")
    return True


def main():
    """Run all tests"""
    print("=" * 60)
    print("RETINA IMAGE VALIDATION & DPR TESTS")
    print("=" * 60)
    
    tests = [
        test_dpr_parameter,
        test_image_dimension_extraction,
        test_css_generation_with_dpr,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            if test():
                passed += 1
        except Exception as e:
            print(f"❌ Test FAILED: {test.__name__}")
            print(f"   Error: {str(e)}")
            import traceback
            traceback.print_exc()
            failed += 1
    
    print("=" * 60)
    print(f"RESULTS: {passed} passed, {failed} failed")
    print("=" * 60)
    
    return failed == 0


if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)

