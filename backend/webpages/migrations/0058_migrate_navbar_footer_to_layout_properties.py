# Generated migration for navbar and footer widget refactoring

from django.db import migrations


def migrate_navbar_footer_to_layout_properties(apps, schema_editor):
    """
    Migrate existing navbar and footer widget configurations to design groups layoutProperties.
    Moves background images, background colors, and text colors from widget config to theme design groups.
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
        
        # Extract widgets from page data
        widgets = version.page_data.get('widgets', [])
        navbar_widgets = [w for w in widgets if w.get('widgetType') == 'easy_widgets.NavbarWidget']
        footer_widgets = [w for w in widgets if w.get('widgetType') == 'easy_widgets.FooterWidget']
        
        if not navbar_widgets and not footer_widgets:
            continue
        
        # Get or create design groups structure
        design_groups = theme.design_groups or {'groups': []}
        if 'groups' not in design_groups:
            design_groups['groups'] = []
        
        # Process Navbar widgets
        if navbar_widgets:
            # Find or create navbar design group
            navbar_group = None
            for group in design_groups['groups']:
                widget_types = group.get('widgetTypes', []) or []
                if 'easy_widgets.NavbarWidget' in widget_types:
                    navbar_group = group
                    break
            
            if not navbar_group:
                navbar_group = {
                    'name': 'Site Navbar',
                    'widgetTypes': ['easy_widgets.NavbarWidget'],
                    'elements': {},
                    'layoutProperties': {}
                }
                design_groups['groups'].append(navbar_group)
            
            # Ensure layoutProperties exists
            if 'layoutProperties' not in navbar_group:
                navbar_group['layoutProperties'] = {}
            
            if 'navbar-widget' not in navbar_group['layoutProperties']:
                navbar_group['layoutProperties']['navbar-widget'] = {}
            
            layout_props = navbar_group['layoutProperties']['navbar-widget']
            
            # Migrate first navbar's config to design group
            config = navbar_widgets[0].get('config', {})
            
            # Migrate background image (single image for all breakpoints)
            background_image = config.get('backgroundImage') or config.get('background_image')
            if background_image:
                # Apply to all breakpoints
                for bp in ['sm', 'md', 'lg', 'xl']:
                    if bp not in layout_props:
                        layout_props[bp] = {}
                    layout_props[bp]['images'] = {
                        'background': background_image
                    }
            
            # Migrate background color (single color for all breakpoints)
            background_color = config.get('backgroundColor') or config.get('background_color')
            if background_color:
                for bp in ['sm', 'md', 'lg', 'xl']:
                    if bp not in layout_props:
                        layout_props[bp] = {}
                    layout_props[bp]['backgroundColor'] = background_color
            
            # Note: text color would be set via design group elements (a, p, etc.)
            # Not migrating here as it's better handled through typography
            
            # Clear widget configs (keep empty dict for backward compatibility)
            for widget in navbar_widgets:
                config = widget.get('config', {})
                # Keep menu items and hamburger breakpoint
                new_config = {
                    'menuItems': config.get('menuItems', config.get('menu_items', [])),
                    'secondaryMenuItems': config.get('secondaryMenuItems', config.get('secondary_menu_items', [])),
                    'hamburgerBreakpoint': config.get('hamburgerBreakpoint', config.get('hamburger_breakpoint', 768))
                }
                widget['config'] = new_config
        
        # Process Footer widgets
        if footer_widgets:
            # Find or create footer design group
            footer_group = None
            for group in design_groups['groups']:
                widget_types = group.get('widgetTypes', []) or []
                if 'easy_widgets.FooterWidget' in widget_types:
                    footer_group = group
                    break
            
            if not footer_group:
                footer_group = {
                    'name': 'Site Footer',
                    'widgetTypes': ['easy_widgets.FooterWidget'],
                    'elements': {},
                    'layoutProperties': {}
                }
                design_groups['groups'].append(footer_group)
            
            # Ensure layoutProperties exists
            if 'layoutProperties' not in footer_group:
                footer_group['layoutProperties'] = {}
            
            if 'footer-widget' not in footer_group['layoutProperties']:
                footer_group['layoutProperties']['footer-widget'] = {}
            
            layout_props = footer_group['layoutProperties']['footer-widget']
            
            # Migrate first footer's config to design group
            config = footer_widgets[0].get('config', {})
            
            # Migrate background image (single image for all breakpoints)
            background_image = config.get('backgroundImage') or config.get('background_image')
            if background_image:
                # Apply to all breakpoints
                for bp in ['sm', 'md', 'lg', 'xl']:
                    if bp not in layout_props:
                        layout_props[bp] = {}
                    layout_props[bp]['images'] = {
                        'background': background_image
                    }
            
            # Migrate background color (single color for all breakpoints)
            background_color = config.get('backgroundColor') or config.get('background_color')
            if background_color:
                for bp in ['sm', 'md', 'lg', 'xl']:
                    if bp not in layout_props:
                        layout_props[bp] = {}
                    layout_props[bp]['backgroundColor'] = background_color
            
            # Migrate text color (single color for all breakpoints)
            text_color = config.get('textColor') or config.get('text_color')
            if text_color:
                for bp in ['sm', 'md', 'lg', 'xl']:
                    if bp not in layout_props:
                        layout_props[bp] = {}
                    layout_props[bp]['color'] = text_color
            
            # Clear widget configs (keep slots)
            for widget in footer_widgets:
                config = widget.get('config', {})
                # Keep only slots
                new_config = {
                    'slots': config.get('slots', {'content': []})
                }
                widget['config'] = new_config
        
        # Save updated theme design groups
        theme.design_groups = design_groups
        themes_to_save.add(theme.id)
        
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
    Reverse migration - restore navbar and footer configs from design groups.
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
        
        # Find navbar design group
        navbar_group = None
        footer_group = None
        for group in theme.design_groups.get('groups', []):
            widget_types = group.get('widgetTypes', [])
            if 'easy_widgets.NavbarWidget' in widget_types:
                navbar_group = group
            if 'easy_widgets.FooterWidget' in widget_types:
                footer_group = group
        
        # Extract widgets
        widgets = version.page_data.get('widgets', [])
        navbar_widgets = [w for w in widgets if w.get('widgetType') == 'easy_widgets.NavbarWidget']
        footer_widgets = [w for w in widgets if w.get('widgetType') == 'easy_widgets.FooterWidget']
        
        # Restore navbar configs
        if navbar_group and navbar_widgets:
            layout_props = navbar_group.get('layoutProperties', {}).get('navbar-widget', {})
            
            for widget in navbar_widgets:
                config = widget.get('config', {})
                
                # Restore from sm breakpoint (use first available)
                if 'sm' in layout_props:
                    sm_props = layout_props['sm']
                    if 'images' in sm_props and 'background' in sm_props['images']:
                        config['backgroundImage'] = sm_props['images']['background']
                    if 'backgroundColor' in sm_props:
                        config['backgroundColor'] = sm_props['backgroundColor']
                
                widget['config'] = config
        
        # Restore footer configs
        if footer_group and footer_widgets:
            layout_props = footer_group.get('layoutProperties', {}).get('footer-widget', {})
            
            for widget in footer_widgets:
                config = widget.get('config', {})
                
                # Restore from sm breakpoint (use first available)
                if 'sm' in layout_props:
                    sm_props = layout_props['sm']
                    if 'images' in sm_props and 'background' in sm_props['images']:
                        config['backgroundImage'] = sm_props['images']['background']
                    if 'backgroundColor' in sm_props:
                        config['backgroundColor'] = sm_props['backgroundColor']
                    if 'color' in sm_props:
                        config['textColor'] = sm_props['color']
                
                widget['config'] = config
        
        # Save updated page version
        version.page_data['widgets'] = widgets
        version.save(update_fields=['page_data'])


class Migration(migrations.Migration):

    dependencies = [
        ('webpages', '0057_migrate_headers_to_layout_properties'),
    ]

    operations = [
        migrations.RunPython(
            migrate_navbar_footer_to_layout_properties,
            reverse_migration
        ),
    ]

