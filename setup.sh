#!/bin/bash
set -e

echo "Setting up FrigateSimpleUI Setup Application..."


echo "Installing client dependencies..."
cd client && npm install && cd ..
# Install server dependencies
echo "Installing server dependencies..."
npm install

# Create logs directory
echo "Creating logs directory..."
mkdir -p logs

# Create .env file from example if it doesn't exist
if [ ! -f ".env" ]; then
  echo "Creating .env file from example..."
  cp .env.example .env
fi

# Build client for production
echo "Building client for production..."
npm run build

echo "Setup complete! You can now run the application with 'npm start' or in development mode with 'npm run dev'" 