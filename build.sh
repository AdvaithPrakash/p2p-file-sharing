#!/bin/bash
echo "Starting build process..."
echo "Current directory: $(pwd)"
echo "Installing dependencies..."
npm install
echo "Building client..."
npm run build
echo "Build completed!"
echo "Checking output:"
ls -la client/dist/
