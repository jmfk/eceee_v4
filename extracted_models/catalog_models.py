#!/usr/bin/env python3
"""
Script to catalog all Django models from extracted model files
"""
import re
import os
from pathlib import Path

def extract_models_from_file(filepath):
    """Extract model class names and their base classes from a Python file"""
    models = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            # Find all class definitions that inherit from models.Model or other Django base classes
            pattern = r'^class\s+(\w+)\s*\((.*?)\):'
            matches = re.finditer(pattern, content, re.MULTILINE)
            for match in matches:
                class_name = match.group(1)
                base_classes = match.group(2).strip()
                # Filter out non-model classes
                if any(keyword in base_classes for keyword in ['Model', 'Displayable', 'Page', 'Orderable', 'Slugged', 'RichText', 'object']):
                    models.append({
                        'name': class_name,
                        'bases': base_classes
                    })
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
    return models

def main():
    # Get all Python files in extracted_models directory
    base_dir = Path(__file__).parent
    model_files = {}

    # Main directory files
    for filepath in sorted(base_dir.glob('*_models.py')):
        app_name = filepath.stem.replace('_models', '')
        models = extract_models_from_file(filepath)
        if models:
            model_files[app_name] = {
                'file': filepath.name,
                'models': models
            }

    # Theme directory files
    themes_dir = base_dir / 'themes'
    if themes_dir.exists():
        for filepath in sorted(themes_dir.glob('*_models.py')):
            app_name = f"themes/{filepath.stem.replace('_models', '')}"
            models = extract_models_from_file(filepath)
            if models:
                model_files[app_name] = {
                    'file': f"themes/{filepath.name}",
                    'models': models
                }

    # Generate README
    readme_content = generate_readme(model_files)
    readme_path = base_dir / 'README.md'
    with open(readme_path, 'w', encoding='utf-8') as f:
        f.write(readme_content)

    print(f"Catalog generated: {readme_path}")
    print(f"Total apps: {len(model_files)}")
    print(f"Total models: {sum(len(info['models']) for info in model_files.values())}")

def generate_readme(model_files):
    """Generate README content"""
    lines = [
        "# Extracted Django Models Catalog\n",
        "This directory contains Django model files extracted from the ECEEE multi-tenant CMS project.\n",
        f"**Total Apps:** {len(model_files)}  ",
        f"**Total Models:** {sum(len(info['models']) for info in model_files.values())}  \n",
        "## Purpose\n",
        "These models have been extracted for use in building migration scripts to migrate the ECEEE database to a new CMS.\n",
        "## Model Files Overview\n",
    ]

    # Group by category
    core_content = {}
    supporting = {}
    widget_system = {}
    themes = {}

    for app_name, info in model_files.items():
        if app_name.startswith('themes/'):
            themes[app_name] = info
        elif app_name.startswith('eceee'):
            core_content[app_name] = info
        elif app_name in ['widget', 'easywidget', 'orderable']:
            widget_system[app_name] = info
        else:
            supporting[app_name] = info

    # Core Content Apps
    if core_content:
        lines.append("\n### Core Content Applications\n")
        for app_name in sorted(core_content.keys()):
            info = core_content[app_name]
            lines.append(f"\n#### {app_name}\n")
            lines.append(f"**File:** `{info['file']}`  \n")
            lines.append(f"**Models:** {len(info['models'])}  \n")
            lines.append("\n| Model Name | Base Classes |\n")
            lines.append("|------------|-------------|\n")
            for model in info['models']:
                lines.append(f"| {model['name']} | {model['bases']} |\n")

    # Widget System
    if widget_system:
        lines.append("\n### Widget System\n")
        for app_name in sorted(widget_system.keys()):
            info = widget_system[app_name]
            lines.append(f"\n#### {app_name}\n")
            lines.append(f"**File:** `{info['file']}`  \n")
            lines.append(f"**Models:** {len(info['models'])}  \n")
            lines.append("\n| Model Name | Base Classes |\n")
            lines.append("|------------|-------------|\n")
            for model in info['models']:
                lines.append(f"| {model['name']} | {model['bases']} |\n")

    # Supporting Apps
    if supporting:
        lines.append("\n### Supporting Applications\n")
        for app_name in sorted(supporting.keys()):
            info = supporting[app_name]
            lines.append(f"\n#### {app_name}\n")
            lines.append(f"**File:** `{info['file']}`  \n")
            lines.append(f"**Models:** {len(info['models'])}  \n")
            lines.append("\n| Model Name | Base Classes |\n")
            lines.append("|------------|-------------|\n")
            for model in info['models']:
                lines.append(f"| {model['name']} | {model['bases']} |\n")

    # Theme Apps
    if themes:
        lines.append("\n### Theme-Specific Models\n")
        for app_name in sorted(themes.keys()):
            info = themes[app_name]
            lines.append(f"\n#### {app_name}\n")
            lines.append(f"**File:** `{info['file']}`  \n")
            lines.append(f"**Models:** {len(info['models'])}  \n")
            if info['models']:
                lines.append("\n| Model Name | Base Classes |\n")
                lines.append("|------------|-------------|\n")
                for model in info['models']:
                    lines.append(f"| {model['name']} | {model['bases']} |\n")

    # Summary by model count
    lines.append("\n## Summary by Model Count\n")
    lines.append("\n| App | Model Count | File |\n")
    lines.append("|-----|-------------|------|\n")

    sorted_apps = sorted(model_files.items(), key=lambda x: len(x[1]['models']), reverse=True)
    for app_name, info in sorted_apps:
        lines.append(f"| {app_name} | {len(info['models'])} | `{info['file']}` |\n")

    lines.append("\n## Key Model Categories\n")
    lines.append("\n### Content Models\n")
    lines.append("- **eceeebase**: Core page types (WebPage, HomePage, SubSitePage, etc.)\n")
    lines.append("- **eceeenews**: News articles with types, categories, and sources\n")
    lines.append("- **eceeecalendar**: Calendar events\n")
    lines.append("- **eceeelibrary**: Library/document management\n")
    lines.append("- **eceeeproceedings**: Conference papers and proceedings\n")
    lines.append("- **eceeecolumnists**: Columnist content\n")
    lines.append("- **eceeegalleries**: Image galleries\n")
    lines.append("- **eceeejobs**: Job listings\n")
    lines.append("\n### System Models\n")
    lines.append("- **widget/easywidget**: Widget system for content blocks\n")
    lines.append("- **orderable**: Ordering functionality\n")
    lines.append("- **attachments**: File attachments\n")
    lines.append("- **easypublisher**: Publishing workflow\n")
    lines.append("- **pageproperties**: Page property management\n")
    lines.append("\n### Theme Models\n")
    lines.append("- **themes/eceee**: Main ECEEE theme\n")
    lines.append("- **themes/briskee**: Briskee project\n")
    lines.append("- **themes/mbenefits**: M-Benefits project\n")
    lines.append("- **themes/energysufficiency**: Energy Sufficiency theme\n")

    lines.append("\n## Notes for Migration\n")
    lines.append("\n1. **Model Inheritance**: Most content models inherit from Mezzanine's `Displayable`, `Page`, or `RichText` base classes\n")
    lines.append("2. **Multi-tenancy**: Models use `eceee_sites` field for multi-site support\n")
    lines.append("3. **Categories**: Custom category system through `GenericCategoriesField` and related models\n")
    lines.append("4. **Widget System**: Sophisticated widget system for page customization\n")
    lines.append("5. **Orderable**: Many models use `Orderable` for manual sorting\n")
    lines.append("6. **Timestamps**: Models inherit publish_date, created, updated from Mezzanine\n")

    return ''.join(lines)

if __name__ == '__main__':
    main()
