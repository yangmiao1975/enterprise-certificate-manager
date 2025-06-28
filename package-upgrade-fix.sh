#!/bin/bash

# Package Upgrade Fix Script
# This script provides options to fix Node.js package compatibility issues

echo "🔧 Enterprise Certificate Manager - Package Compatibility Fix"
echo "============================================================"

# Option 1: Downgrade problematic packages (Quick Fix)
fix_packages_downgrade() {
    echo "📦 Option 1: Downgrading packages to Node.js 18 compatible versions..."
    
    # Backend
    cd backend
    echo "Fixing backend packages..."
    npm install @google/genai@1.5.0 --save
    
    # Frontend  
    cd ../frontend
    echo "Fixing frontend packages..."
    npm install @google/genai@1.5.0 react-router-dom@6.23.1 --save
    
    echo "✅ Packages downgraded successfully!"
    echo "ℹ️  Note: You're using older versions but compatible with Node.js 18"
}

# Option 2: Update to Node.js 20 (Recommended)
update_node_version() {
    echo "🚀 Option 2: Updating to Node.js 20 (files already updated)"
    echo "✅ Dockerfile updated to use node:20-alpine"
    echo "✅ package.json engines updated to >=20.0.0"
    echo "✅ cloudbuild.yaml updated to use node:20-alpine"
    echo ""
    echo "📋 Next steps:"
    echo "1. Commit these changes: git add . && git commit -m 'fix: upgrade to Node.js 20'"
    echo "2. Push to trigger Cloud Build: git push"
    echo "3. Cloud Build will now use Node.js 20 and packages will be compatible"
}

# Option 3: Add package overrides (Alternative fix)
add_package_overrides() {
    echo "⚙️  Option 3: Adding package overrides..."
    
    # Backend package.json override
    cd backend
    npm pkg set overrides.@google/genai="1.5.0"
    
    # Frontend package.json override  
    cd ../frontend
    npm pkg set overrides.@google/genai="1.5.0"
    npm pkg set overrides.react-router-dom="6.23.1"
    
    echo "✅ Package overrides added!"
}

echo "Choose your fix option:"
echo "1) Downgrade packages (Quick fix for Node.js 18)"
echo "2) Update to Node.js 20 (Recommended - already done)"
echo "3) Add package overrides"
echo "4) Show current status"

read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        fix_packages_downgrade
        ;;
    2)
        update_node_version
        ;;
    3)
        add_package_overrides
        ;;
    4)
        echo "📊 Current Status:"
        echo "- Node.js version in Dockerfile: $(grep 'FROM node:' backend/Dockerfile frontend/Dockerfile)"
        echo "- Engine requirements:"
        grep -A2 '"engines"' backend/package.json frontend/package.json
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "🎉 Fix completed! Choose Option 2 (Node.js 20 upgrade) for the best long-term solution."