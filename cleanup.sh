#!/bin/bash

# Cleanup script for FrigateSimpleUI Setup
# This script removes unused and temporary files from the project

echo "Cleaning up FrigateSimpleUI Setup project..."

# Remove temporary files
find . -name "*.tmp" -type f -delete
find . -name "*.bak" -type f -delete
find . -name "*.log" -type f -delete
find . -name ".DS_Store" -type f -delete

# Remove temporary directories
rm -rf ./.cache
rm -rf ./.vscode
rm -rf ./node_modules/.cache

# Remove redundant endpoint files
rm -rf ./server/routes/testStream.js

# Display notice about .env files
echo "NOTE: .env* files are preserved for configuration."

# Remove unused files in client build (if it exists)
if [ -d "./client/build" ]; then
  echo "Cleaning client build directory..."
  find ./client/build -name "*.map" -type f -delete
fi

echo "Cleanup complete!" 