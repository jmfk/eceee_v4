# Generated migration for header widget refactoring

from django.db import migrations


def migrate_headers_to_layout_properties(apps, schema_editor):
    """
    Migrate existing header widget configurations to design groups layoutProperties.
    Moves images and dimensions from widget config to theme design groups.
    """
    WebPage = apps.get_model('webpages', 'WebPage')
    PageTheme = apps.get_model('webpages', 'PageTheme')
    PageVersion = apps.get_model('webpages', 'PageVersion')
    
    # Track themes that need saving
    themes_to_save = set()
    
    # Process all pages
    for page in WebPage.objects.all():
        # Get current version
        try:
            version = page.versions.filter(is_current=True).first()
            if not version or not version.page_data:
                continue
        except Exception:
            continue
        
        # Get effective theme
        theme = page.theme
        if not theme:
            # Walk up parent chain to find theme
            current = page
            while current.parent and not theme:
                current = current.parent
                theme = current.theme
        
        if not theme:
            continue
        
        # Extract header widgets from page data
        widgets = version.page_data.get('widgets', [])
        header_widgets = [w for w in widgets if w.get('widgetType') == 'easy_widgets.HeaderWidget']
        
        if not header_widgets:
            continue
        
        # Get or create design groups structure
        design_groups = theme.design_groups or {'groups': []}
        if 'groups' not in design_groups:
            design_groups['groups'] = []
        
        # Find or create header design group
        header_group = None
        for group in design_groups['groups']:
            widget_types = group.get('widgetTypes', []) or []
            if 'easy_widgets.HeaderWidget' in widget_types:
                header_group = group
                break
        
        if not header_group:
            # Create new design group for headers
            header_group = {
                'name': 'Site Header',
                'widgetTypes': ['easy_widgets.HeaderWidget'],
                'elements': {},
                'layoutProperties': {}
            }
            design_groups['groups'].append(header_group)
        
        # Ensure layoutProperties exists
        if 'layoutProperties' not in header_group:
            header_group['layoutProperties'] = {}
        
        if 'header-widget' not in header_group['layoutProperties']:
            header_group['layoutProperties']['header-widget'] = {}
        
        layout_props = header_group['layoutProperties']['header-widget']
        
        # Migrate first header's config to design group
        # (assuming all headers on the page should use the same styling)
        config = header_widgets[0].get('config', {})
        
        # Migrate mobile (sm breakpoint)
        mobile_image = config.get('mobileImage') or config.get('mobile_image')
        if mobile_image:
            if 'sm' not in layout_props:
                layout_props['sm'] = {}
            
            mobile_height = config.get('mobileHeight') or config.get('mobile_height', 80)
            layout_props['sm']['height'] = f"{mobile_height}px"
            layout_props['sm']['images'] = {
                'background': mobile_image
            }
        
        # Migrate tablet (md breakpoint)
        tablet_image = config.get('tabletImage') or config.get('tablet_image')
        if tablet_image:
            if 'md' not in layout_props:
                layout_props['md'] = {}
            
            tablet_height = config.get('tabletHeight') or config.get('tablet_height', 112)
            layout_props['md']['height'] = f"{tablet_height}px"
            layout_props['md']['images'] = {
                'background': tablet_image
            }
        
        # Migrate desktop (lg breakpoint)
        desktop_image = config.get('image')
        if desktop_image:
            if 'lg' not in layout_props:
                layout_props['lg'] = {}
            
            desktop_height = config.get('height', 112)
            layout_props['lg']['height'] = f"{desktop_height}px"
            layout_props['lg']['images'] = {
                'background': desktop_image
            }
        
        # Save updated theme design groups
        theme.design_groups = design_groups
        themes_to_save.add(theme.id)
        
        # Clear widget configs (keep empty dict for backward compatibility)
        for widget in header_widgets:
            widget['config'] = {}
        
        # Save updated page version
        version.page_data['widgets'] = widgets
        version.save(update_fields=['page_data'])
    
    # Bulk save themes
    for theme_id in themes_to_save:
        try:
            theme = PageTheme.objects.get(id=theme_id)
            theme.save(update_fields=['design_groups'])
        except PageTheme.DoesNotExist:
            pass


def reverse_migration(apps, schema_editor):
    """
    Reverse migration - restore header configs from design groups.
    Note: This is a best-effort reversal and may not be perfect.
    """
    WebPage = apps.get_model('webpages', 'WebPage')
    PageTheme = apps.get_model('webpages', 'PageTheme')
    PageVersion = apps.get_model('webpages', 'PageVersion')
    
    # Process all pages
    for page in WebPage.objects.all():
        try:
            version = page.versions.filter(is_current=True).first()
            if not version or not version.page_data:
                continue
        except Exception:
            continue
        
        # Get effective theme
        theme = page.theme
        if not theme:
            current = page
            while current.parent and not theme:
                current = current.parent
                theme = current.theme
        
        if not theme or not theme.design_groups:
            continue
        
        # Find header design group
        header_group = None
        for group in theme.design_groups.get('groups', []):
            widget_types = group.get('widgetTypes', [])
            if 'easy_widgets.HeaderWidget' in widget_types:
                header_group = group
                break
        
        if not header_group:
            continue
        
        layout_props = header_group.get('layoutProperties', {}).get('header-widget', {})
        
        # Extract header widgets
        widgets = version.page_data.get('widgets', [])
        header_widgets = [w for w in widgets if w.get('widgetType') == 'easy_widgets.HeaderWidget']
        
        if not header_widgets:
            continue
        
        # Restore config for all header widgets
        for widget in header_widgets:
            config = {}
            
            # Restore from sm breakpoint
            if 'sm' in layout_props:
                sm_props = layout_props['sm']
                if 'images' in sm_props and 'background' in sm_props['images']:
                    config['mobileImage'] = sm_props['images']['background']
                if 'height' in sm_props:
                    # Extract numeric value from "80px"
                    height_str = sm_props['height'].replace('px', '')
                    try:
                        config['mobileHeight'] = int(height_str)
                    except ValueError:
                        config['mobileHeight'] = 80
            
            # Restore from md breakpoint
            if 'md' in layout_props:
                md_props = layout_props['md']
                if 'images' in md_props and 'background' in md_props['images']:
                    config['tabletImage'] = md_props['images']['background']
                if 'height' in md_props:
                    height_str = md_props['height'].replace('px', '')
                    try:
                        config['tabletHeight'] = int(height_str)
                    except ValueError:
                        config['tabletHeight'] = 112
            
            # Restore from lg breakpoint
            if 'lg' in layout_props:
                lg_props = layout_props['lg']
                if 'images' in lg_props and 'background' in lg_props['images']:
                    config['image'] = lg_props['images']['background']
                if 'height' in lg_props:
                    height_str = lg_props['height'].replace('px', '')
                    try:
                        config['height'] = int(height_str)
                    except ValueError:
                        config['height'] = 112
            
            widget['config'] = config
        
        # Save updated page version
        version.page_data['widgets'] = widgets
        version.save(update_fields=['page_data'])


class Migration(migrations.Migration):

    dependencies = [
        ('webpages', '0056_alter_pagetheme_design_groups'),
    ]

    operations = [
        migrations.RunPython(
            migrate_headers_to_layout_properties,
            reverse_migration
        ),
    ]

