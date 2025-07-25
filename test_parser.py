#!/usr/bin/env python
"""
Quick test of the template parser
"""

import os
import sys
import django

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from backend.webpages.utils.template_parser import TemplateParser
import json

def test_parser():
    parser = TemplateParser()
    
    try:
        # Test parsing the updated sidebar layout
        result = parser.parse_template('webpages/layouts/sidebar_layout.html')
        
        print("✅ Parser test successful!")
        print("📄 Layout structure:")
        print(json.dumps(result, indent=2))
        
        # Check for slots
        if 'type' in result and result['type'] == 'element':
            print(f"\n🎯 Root element: <{result['tag']}> with classes: {result.get('classes', 'none')}")
            
            # Count slots
            slot_count = count_slots(result)
            print(f"🔧 Found {slot_count} slots in the layout")
            
            # List slot names
            slot_names = extract_slot_names(result)
            print(f"📍 Slot names: {', '.join(slot_names)}")
            
    except Exception as e:
        print(f"❌ Parser test failed: {e}")
        import traceback
        traceback.print_exc()

def count_slots(node, count=0):
    """Recursively count slots in the layout"""
    if isinstance(node, dict):
        if node.get('type') == 'slot':
            count += 1
        if 'children' in node:
            for child in node['children']:
                count = count_slots(child, count)
    return count

def extract_slot_names(node, names=None):
    """Recursively extract slot names"""
    if names is None:
        names = []
    
    if isinstance(node, dict):
        if node.get('type') == 'slot' and 'slot' in node:
            names.append(node['slot']['name'])
        if 'children' in node:
            for child in node['children']:
                extract_slot_names(child, names)
    
    return names

if __name__ == '__main__':
    test_parser()