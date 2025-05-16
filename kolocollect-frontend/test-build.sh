#!/bin/bash

# Build script to test SCSS optimization impact
echo "===== SCSS Optimization Test Build ====="
echo "Starting production build with stats..."

# Build the application with production settings and stats
ng build --configuration=production --stats-json

# Check build status
if [ $? -eq 0 ]; then
  echo "Build completed successfully!"
  echo "Checking bundle sizes..."
  
  # Optional: If you have source-map-explorer installed
  # echo "Running source-map analysis..."
  # source-map-explorer dist/kolocollect-frontend/browser/main.*.js
  
  echo ""
  echo "To analyze bundles in detail:"
  echo "1. Install webpack-bundle-analyzer: npm install -g webpack-bundle-analyzer"
  echo "2. Run: webpack-bundle-analyzer dist/kolocollect-frontend/browser/stats.json"
  
  echo ""
  echo "Check the terminal output above for bundle sizes"
  echo "Compare with original sizes from scss-optimization-progress.md"
else
  echo "Build failed. Check errors above."
fi
