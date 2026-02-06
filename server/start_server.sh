#!/bin/bash
# Start the Pumped Up Kicks API server

cd "$(dirname "$0")"

echo "Starting Pumped Up Kicks API Server..."
echo "========================================"
echo ""

# Activate virtual environment
source venv/bin/activate

# Start server
echo "Starting uvicorn on http://localhost:8000"
echo "API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop the server"
echo "========================================"
echo ""

uvicorn api.main:app --reload --port 8000
