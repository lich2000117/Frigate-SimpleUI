#!/bin/bash
./setup.sh

# Simple development startup script for FrigateSimpleUI Setup

# Kill any processes running on required ports (3000, 3001)
kill_port() {
  local port=$1
  local pid=$(lsof -ti:$port)
  if [ -n "$pid" ]; then
    echo "Killing process $pid on port $port"
    kill -9 $pid
  fi
}

kill_port 3001


# Production startup script for FrigateSimpleUI Setup

# Check if .env.production exists
if [ ! -f .env.production ]; then
  echo "Error: .env.production file not found!"
  echo "Please create it with your production settings"
  exit 1
fi

# Use production environment
cp .env.production .env

# Make sure the client is built with production settings
if [ ! -d "client/build" ] || [ "$1" == "--rebuild" ]; then
  echo "Building client application..."
  cd client
  
  # Update API config for production if needed
  # Uncomment and modify this if you want to automatically set the server URL
  # sed -i 's|SERVER_URL: .*|SERVER_URL: "http://your-server-ip:3001",|' src/services/api.js
  
  npm run build
  cd ..
fi

# Start the server in production mode
echo "Starting FrigateSimpleUI Setup server in production mode..."

npm install -g pm2
pm2 delete all
pm2 start npm --name "frigatesimpleui-setup" -- start
pm2 startup
pm2 save

echo "FrigateSimpleUI Setup server started in production mode."
echo "You can access the application at http://localhost:3001"
echo "To stop the server, use 'pm2 stop frigatesimpleui-setup'"
echo "To view logs, use 'pm2 logs frigatesimpleui-setup'"
echo "To restart the server, use 'pm2 restart frigatesimpleui-setup'"
echo "To stop the server, use 'pm2 stop frigatesimpleui-setup'"
echo "To delete the server, use 'pm2 delete frigatesimpleui-setup'"