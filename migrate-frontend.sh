#!/bin/bash

# Frontend Migration Script
# This script moves the existing frontend code to the new structure

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "App.tsx" ] || [ ! -f "package.json" ]; then
    print_error "This script must be run from the project root directory"
    exit 1
fi

print_status "Starting frontend migration..."

# Create frontend directory if it doesn't exist
if [ ! -d "frontend" ]; then
    mkdir -p frontend
    print_status "Created frontend directory"
fi

# Move existing frontend files
print_status "Moving existing frontend files..."

# Move React components
if [ -d "components" ]; then
    mv components frontend/src/
    print_status "Moved components directory"
fi

# Move services
if [ -d "services" ]; then
    mv services frontend/src/
    print_status "Moved services directory"
fi

# Move individual files
files_to_move=(
    "App.tsx"
    "index.tsx"
    "index.html"
    "types.ts"
    "constants.tsx"
    "vite.config.ts"
    "tsconfig.json"
)

for file in "${files_to_move[@]}"; do
    if [ -f "$file" ]; then
        if [[ "$file" == "App.tsx" || "$file" == "index.tsx" ]]; then
            mv "$file" "frontend/src/"
        elif [[ "$file" == "index.html" ]]; then
            mv "$file" "frontend/"
        elif [[ "$file" == "vite.config.ts" || "$file" == "tsconfig.json" ]]; then
            mv "$file" "frontend/"
        else
            mv "$file" "frontend/src/"
        fi
        print_status "Moved $file"
    fi
done

# Create src directory structure
mkdir -p frontend/src/{components,services,utils,hooks,types}

# Move the new API service files
if [ -f "frontend/src/services/mockApiService.ts" ]; then
    print_status "Mock API service already exists"
else
    print_warning "Please create the mock API service files manually"
fi

# Update package.json for frontend
if [ -f "package.json" ]; then
    print_status "Updating frontend package.json..."
    
    # Read the existing package.json
    if [ -f "frontend/package.json" ]; then
        print_warning "Frontend package.json already exists, skipping..."
    else
        # Create a basic frontend package.json
        cat > frontend/package.json << 'EOF'
{
  "name": "certificate-manager-frontend",
  "version": "1.0.0",
  "description": "Frontend for Enterprise Certificate Manager",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "build:docker": "vite build --mode docker",
    "build:serverless": "vite build --mode serverless",
    "build:vm": "vite build --mode vm",
    "serve": "serve -s dist -l 3000"
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "@google/genai": "^1.5.1",
    "pkijs": "^3.2.5",
    "asn1js": "^3.0.6",
    "axios": "^1.6.0",
    "react-router-dom": "^6.20.0",
    "react-query": "^3.39.3",
    "react-hook-form": "^7.48.2",
    "react-hot-toast": "^2.4.1",
    "date-fns": "^2.30.0",
    "clsx": "^2.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.14.0",
    "@types/react": "^18.2.37",
    "@types/react-dom": "^18.2.15",
    "@vitejs/plugin-react": "^4.1.1",
    "typescript": "~5.7.2",
    "vite": "^6.2.0",
    "serve": "^14.2.1"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF
        print_status "Created frontend package.json"
    fi
fi

# Create main.tsx entry point
if [ ! -f "frontend/src/main.tsx" ]; then
    cat > frontend/src/main.tsx << 'EOF'
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
EOF
    print_status "Created main.tsx entry point"
fi

# Create basic CSS file
if [ ! -f "frontend/src/index.css" ]; then
    cat > frontend/src/index.css << 'EOF'
/* Basic CSS reset and global styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background-color: #f5f5f5;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}

/* Preview mode indicator */
.preview-mode {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: #ff6b6b;
  color: white;
  text-align: center;
  padding: 8px;
  font-size: 14px;
  z-index: 9999;
}
EOF
    print_status "Created index.css"
fi

# Create types directory and move types
if [ -f "frontend/src/types.ts" ]; then
    mv frontend/src/types.ts frontend/src/types/index.ts
    print_status "Moved types to types directory"
fi

print_success "Frontend migration completed!"
print_status ""
print_status "Next steps:"
print_status "1. Run: ./deploy.sh preview"
print_status "2. Or install dependencies: cd frontend && npm install"
print_status "3. Start development: cd frontend && npm run dev"
print_status ""
print_warning "Note: You may need to update import paths in your components"
print_warning "to reflect the new directory structure." 