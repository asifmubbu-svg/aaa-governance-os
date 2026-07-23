#!/bin/bash
# Governance OS launcher (full-stack) — installs deps on first run, starts the server, opens the app
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then
  echo "First run: installing dependencies (this takes a minute)…"
  npm install || { echo "npm install failed — is Node.js 22+ installed?"; exit 1; }
fi
# free the port if a previous instance is still holding it
PORT=${PORT:-4000}
PID=$(lsof -ti tcp:$PORT 2>/dev/null)
if [ -n "$PID" ]; then echo "Stopping previous server on port $PORT (pid $PID)…"; kill $PID 2>/dev/null; sleep 1; fi
echo "Starting Governance OS server at http://localhost:$PORT ..."
( sleep 2; open "http://localhost:$PORT/" ) &
PORT=$PORT npm start
