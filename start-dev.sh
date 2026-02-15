#!/bin/bash

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

# Make sure the server is using development .env
cp .env.development .env 2>/dev/null || cp .env .env.development

# Start the server and client
echo "Starting FrigateSimpleUI Setup in development mode..."
npm run dev 