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

if [ ! -d "backend/eceee_layouts" ]; then
    missing_dirs+=("backend/eceee_layouts")
fi

if [ ! -d "backend/eceee_widgets" ]; then
    missing_dirs+=("backend/eceee_widgets")
fi

if [ ! -d "frontend/src/layouts/eceee-layouts" ]; then
    missing_dirs+=("frontend/src/layouts/eceee-layouts")
fi

if [ ! -d "frontend/src/widgets/eceee-widgets" ]; then
    missing_dirs+=("frontend/src/widgets/eceee-widgets")
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
if [ -d "backend/eceee_layouts" ]; then
    echo "  📤 Copying backend/eceee_layouts..."
    rm -rf "$ECEEE_COMPONENTS_PATH/backend/eceee_layouts"
    cp -r backend/eceee_layouts "$ECEEE_COMPONENTS_PATH/backend/"
else
    echo "  ⏭️  Skipping backend/eceee_layouts (not found)"
fi

if [ -d "backend/eceee_widgets" ]; then
    echo "  📤 Copying backend/eceee_widgets..."
    rm -rf "$ECEEE_COMPONENTS_PATH/backend/eceee_widgets"
    cp -r backend/eceee_widgets "$ECEEE_COMPONENTS_PATH/backend/"
else
    echo "  ⏭️  Skipping backend/eceee_widgets (not found)"
fi

echo "📁 Syncing frontend components..."

# Copy frontend components if they exist
if [ -d "frontend/src/layouts/eceee-layouts" ]; then
    echo "  📤 Copying frontend/src/layouts/eceee-layouts..."
    rm -rf "$ECEEE_COMPONENTS_PATH/frontend/src/layouts/eceee-layouts"
    mkdir -p "$ECEEE_COMPONENTS_PATH/frontend/src/layouts/"
    cp -r frontend/src/layouts/eceee-layouts "$ECEEE_COMPONENTS_PATH/frontend/src/layouts/"
else
    echo "  ⏭️  Skipping frontend/src/layouts/eceee-layouts (not found)"
fi

if [ -d "frontend/src/widgets/eceee-widgets" ]; then
    echo "  📤 Copying frontend/src/widgets/eceee-widgets..."
    rm -rf "$ECEEE_COMPONENTS_PATH/frontend/src/widgets/eceee-widgets"
    mkdir -p "$ECEEE_COMPONENTS_PATH/frontend/src/widgets/"
    cp -r frontend/src/widgets/eceee-widgets "$ECEEE_COMPONENTS_PATH/frontend/src/widgets/"
else
    echo "  ⏭️  Skipping frontend/src/widgets/eceee-widgets (not found)"
fi

echo "✅ Sync complete! Components copied from eceee_v4 to eceee-components"
echo ""
echo "📋 Summary:"
echo "  • eceee-components/backend/eceee_layouts ← backend/eceee_layouts"
echo "  • eceee-components/backend/eceee_widgets ← backend/eceee_widgets"
echo "  • eceee-components/frontend/src/layouts/eceee-layouts ← frontend/src/layouts/eceee-layouts"
echo "  • eceee-components/frontend/src/widgets/eceee-widgets ← frontend/src/widgets/eceee-widgets"
echo ""
echo "💡 Next steps:"
echo "   cd $ECEEE_COMPONENTS_PATH"
echo "   git add ."
echo "   git commit -m 'Update components from eceee_v4'"
echo "   git push origin main"
