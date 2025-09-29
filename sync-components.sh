#!/bin/bash

# ECEEE Components Sync Script
# This script helps sync the eceee_layouts and eceee_widgets components 
# to the private repository using git subtrees

set -e

PRIVATE_REPO="https://github.com/jmfk/eceee-components.git"
LAYOUTS_PREFIX="backend/eceee_layouts"
WIDGETS_PREFIX="backend/eceee_widgets"

echo "🔄 ECEEE Components Sync Script"
echo "================================"

# Function to show usage
show_usage() {
    echo "Usage: $0 [layouts|widgets|both] [push|pull]"
    echo ""
    echo "Commands:"
    echo "  layouts push    - Push layout changes to private repo"
    echo "  widgets push    - Push widget changes to private repo"  
    echo "  both push       - Push both components to private repo"
    echo "  layouts pull    - Pull layout changes from private repo"
    echo "  widgets pull    - Pull widget changes from private repo"
    echo "  both pull       - Pull both components from private repo"
    echo ""
    echo "Examples:"
    echo "  $0 layouts push"
    echo "  $0 both push"
    echo "  $0 widgets pull"
}

# Check if we're in the right directory
if [ ! -d "backend/eceee_layouts" ] || [ ! -d "backend/eceee_widgets" ]; then
    echo "❌ Error: This script must be run from the eceee_v4 project root"
    echo "   Make sure you're in the directory containing backend/eceee_layouts and backend/eceee_widgets"
    exit 1
fi

# Check arguments
if [ $# -ne 2 ]; then
    echo "❌ Error: Invalid number of arguments"
    show_usage
    exit 1
fi

COMPONENT=$1
ACTION=$2

# Validate component argument
if [ "$COMPONENT" != "layouts" ] && [ "$COMPONENT" != "widgets" ] && [ "$COMPONENT" != "both" ]; then
    echo "❌ Error: Invalid component '$COMPONENT'"
    show_usage
    exit 1
fi

# Validate action argument  
if [ "$ACTION" != "push" ] && [ "$ACTION" != "pull" ]; then
    echo "❌ Error: Invalid action '$ACTION'"
    show_usage
    exit 1
fi

# Function to sync layouts
sync_layouts() {
    local action=$1
    echo "📦 Syncing layouts..."
    
    if [ "$action" = "push" ]; then
        echo "   Pushing layouts to private repository..."
        git subtree push --prefix=$LAYOUTS_PREFIX $PRIVATE_REPO layouts
        echo "   ✅ Layouts pushed successfully"
    else
        echo "   Pulling layouts from private repository..."
        git subtree pull --prefix=$LAYOUTS_PREFIX $PRIVATE_REPO layouts --squash
        echo "   ✅ Layouts pulled successfully"
    fi
}

# Function to sync widgets
sync_widgets() {
    local action=$1
    echo "🧩 Syncing widgets..."
    
    if [ "$action" = "push" ]; then
        echo "   Pushing widgets to private repository..."
        git subtree push --prefix=$WIDGETS_PREFIX $PRIVATE_REPO widgets
        echo "   ✅ Widgets pushed successfully"
    else
        echo "   Pulling widgets from private repository..."
        git subtree pull --prefix=$WIDGETS_PREFIX $PRIVATE_REPO widgets --squash
        echo "   ✅ Widgets pulled successfully"
    fi
}

# Main execution
echo "🚀 Starting sync operation..."
echo "   Component: $COMPONENT"
echo "   Action: $ACTION"
echo "   Private repo: $PRIVATE_REPO"
echo ""

case $COMPONENT in
    "layouts")
        sync_layouts $ACTION
        ;;
    "widgets")
        sync_widgets $ACTION
        ;;
    "both")
        sync_layouts $ACTION
        sync_widgets $ACTION
        ;;
esac

echo ""
echo "🎉 Sync operation completed successfully!"
echo ""
echo "💡 Remember:"
echo "   - The components remain in their original location for development"
echo "   - The private repository is at: https://github.com/jmfk/eceee-components"
echo "   - Use 'push' to sync your local changes to the private repo"
echo "   - Use 'pull' to get changes from the private repo (if any)"
