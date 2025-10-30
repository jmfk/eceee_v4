#!/bin/bash
# sync-to-eceee-components.sh
# Copies components FROM eceee_v4 project TO eceee-components repository

set -e  # Exit on any error

ECEEE_COMPONENTS_PATH="/Users/jmfk/code/eceee-components"
ECEEE_V4_PATH="/Users/jmfk/code/eceee_v4"

echo "🔄 Syncing components FROM eceee_v4 TO eceee-components..."

# Check if eceee-components repository exists
if [ ! -d "$ECEEE_COMPONENTS_PATH" ]; then
    echo "❌ Error: eceee-components repository not found at $ECEEE_COMPONENTS_PATH"
    echo "   Please make sure the eceee-components repository is cloned to that location."
    exit 1
fi

cd "$ECEEE_V4_PATH"

# Check if source directories exist
missing_dirs=()

if [ ! -d "backend/easy_layouts" ]; then
    missing_dirs+=("backend/easy_layouts")
fi

if [ ! -d "backend/easy_widgets" ]; then
    missing_dirs+=("backend/easy_widgets")
fi

if [ ! -d "frontend/src/layouts/easy-layouts" ]; then
    missing_dirs+=("frontend/src/layouts/easy-layouts")
fi

if [ ! -d "frontend/src/widgets/easy-widgets" ]; then
    missing_dirs+=("frontend/src/widgets/easy-widgets")
fi

if [ ${#missing_dirs[@]} -gt 0 ]; then
    echo "⚠️  Warning: Some source directories are missing:"
    for dir in "${missing_dirs[@]}"; do
        echo "   • $dir"
    done
    echo ""
    echo "🤔 Do you want to continue with the available directories? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "❌ Sync cancelled."
        exit 1
    fi
fi

echo "📁 Syncing backend components..."

# Copy backend components if they exist
if [ -d "backend/easy_layouts" ]; then
    echo "  📤 Copying backend/easy_layouts..."
    rm -rf "$ECEEE_COMPONENTS_PATH/backend/easy_layouts"
    cp -r backend/easy_layouts "$ECEEE_COMPONENTS_PATH/backend/"
else
    echo "  ⏭️  Skipping backend/easy_layouts (not found)"
fi

if [ -d "backend/easy_widgets" ]; then
    echo "  📤 Copying backend/easy_widgets..."
    rm -rf "$ECEEE_COMPONENTS_PATH/backend/easy_widgets"
    cp -r backend/easy_widgets "$ECEEE_COMPONENTS_PATH/backend/"
else
    echo "  ⏭️  Skipping backend/easy_widgets (not found)"
fi

echo "📁 Syncing frontend components..."

# Copy frontend components if they exist
if [ -d "frontend/src/layouts/easy-layouts" ]; then
    echo "  📤 Copying frontend/src/layouts/easy-layouts..."
    rm -rf "$ECEEE_COMPONENTS_PATH/frontend/src/layouts/easy-layouts"
    mkdir -p "$ECEEE_COMPONENTS_PATH/frontend/src/layouts/"
    cp -r frontend/src/layouts/easy-layouts "$ECEEE_COMPONENTS_PATH/frontend/src/layouts/"
else
    echo "  ⏭️  Skipping frontend/src/layouts/easy-layouts (not found)"
fi

if [ -d "frontend/src/widgets/easy-widgets" ]; then
    echo "  📤 Copying frontend/src/widgets/easy-widgets..."
    rm -rf "$ECEEE_COMPONENTS_PATH/frontend/src/widgets/easy-widgets"
    mkdir -p "$ECEEE_COMPONENTS_PATH/frontend/src/widgets/"
    cp -r frontend/src/widgets/easy-widgets "$ECEEE_COMPONENTS_PATH/frontend/src/widgets/"
else
    echo "  ⏭️  Skipping frontend/src/widgets/easy-widgets (not found)"
fi

echo "✅ Sync complete! Components copied from eceee_v4 to eceee-components"
echo ""
echo "📋 Summary:"
echo "  • eceee-components/backend/easy_layouts ← backend/easy_layouts"
echo "  • eceee-components/backend/easy_widgets ← backend/easy_widgets"
echo "  • eceee-components/frontend/src/layouts/easy-layouts ← frontend/src/layouts/easy-layouts"
echo "  • eceee-components/frontend/src/widgets/easy-widgets ← frontend/src/widgets/easy-widgets"
echo ""
echo "💡 Next steps:"
echo "   cd $ECEEE_COMPONENTS_PATH"
echo "   git add ."
echo "   git commit -m 'Update components from eceee_v4'"
echo "   git push origin main"
