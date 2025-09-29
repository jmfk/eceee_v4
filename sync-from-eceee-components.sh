#!/bin/bash
# sync-from-eceee-components.sh
# Copies components FROM eceee-components repository TO eceee_v4 project

set -e  # Exit on any error

ECEEE_COMPONENTS_PATH="/Users/jmfk/code/eceee-components"
ECEEE_V4_PATH="/Users/jmfk/code/eceee_v4"

echo "🔄 Syncing components FROM eceee-components TO eceee_v4..."

# Check if eceee-components repository exists
if [ ! -d "$ECEEE_COMPONENTS_PATH" ]; then
    echo "❌ Error: eceee-components repository not found at $ECEEE_COMPONENTS_PATH"
    echo "   Please make sure the eceee-components repository is cloned to that location."
    exit 1
fi

cd "$ECEEE_V4_PATH"

echo "📁 Syncing backend components..."

# Remove existing backend directories if they exist
rm -rf backend/eceee_layouts backend/eceee_widgets

# Copy backend components
echo "  📥 Copying backend/eceee_layouts..."
cp -r "$ECEEE_COMPONENTS_PATH/backend/eceee_layouts" backend/

echo "  📥 Copying backend/eceee_widgets..."
cp -r "$ECEEE_COMPONENTS_PATH/backend/eceee_widgets" backend/

echo "📁 Syncing frontend components..."

# Remove existing frontend directories if they exist
rm -rf frontend/src/layouts/eceee-layouts frontend/src/widgets/eceee-widgets

# Copy frontend components
echo "  📥 Copying frontend/src/layouts/eceee-layouts..."
mkdir -p frontend/src/layouts/
cp -r "$ECEEE_COMPONENTS_PATH/frontend/src/layouts/eceee-layouts" frontend/src/layouts/

echo "  📥 Copying frontend/src/widgets/eceee-widgets..."
mkdir -p frontend/src/widgets/
cp -r "$ECEEE_COMPONENTS_PATH/frontend/src/widgets/eceee-widgets" frontend/src/widgets/

echo "✅ Sync complete! Components copied from eceee-components to eceee_v4"
echo ""
echo "📋 Summary:"
echo "  • backend/eceee_layouts ← eceee-components/backend/eceee_layouts"
echo "  • backend/eceee_widgets ← eceee-components/backend/eceee_widgets"
echo "  • frontend/src/layouts/eceee-layouts ← eceee-components/frontend/src/layouts/eceee-layouts"
echo "  • frontend/src/widgets/eceee-widgets ← eceee-components/frontend/src/widgets/eceee-widgets"
echo ""
echo "💡 Note: These files are now local copies. Use sync-to-eceee-components.sh to push changes back."
