"""
Django management command to test the template parser
"""

from django.core.management.base import BaseCommand
from webpages.utils.template_parser import TemplateParser
import json


class Command(BaseCommand):
    help = 'Test the template parser functionality'

    def handle(self, *args, **options):
        self.stdout.write("🧪 Testing template parser...")
        
        parser = TemplateParser()
        
        try:
            # Test parsing the updated sidebar layout
            result = parser.parse_template('webpages/layouts/sidebar_layout.html')
            
            self.stdout.write(self.style.SUCCESS("✅ Parser test successful!"))
            self.stdout.write("📄 Layout structure:")
            self.stdout.write(json.dumps(result, indent=2))
            
            # Check for slots
            if 'type' in result and result['type'] == 'element':
                self.stdout.write(f"\n🎯 Root element: <{result['tag']}> with classes: {result.get('classes', 'none')}")
                
                # Count slots
                slot_count = self.count_slots(result)
                self.stdout.write(f"🔧 Found {slot_count} slots in the layout")
                
                # List slot names
                slot_names = self.extract_slot_names(result)
                self.stdout.write(f"📍 Slot names: {', '.join(slot_names)}")
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"❌ Parser test failed: {e}"))
            import traceback
            traceback.print_exc()

    def count_slots(self, node, count=0):
        """Recursively count slots in the layout"""
        if isinstance(node, dict):
            if node.get('type') == 'slot':
                count += 1
            if 'children' in node:
                for child in node['children']:
                    count = self.count_slots(child, count)
        return count

    def extract_slot_names(self, node, names=None):
        """Recursively extract slot names"""
        if names is None:
            names = []
        
        if isinstance(node, dict):
            if node.get('type') == 'slot' and 'slot' in node:
                names.append(node['slot']['name'])
            if 'children' in node:
                for child in node['children']:
                    self.extract_slot_names(child, names)
        
        return names