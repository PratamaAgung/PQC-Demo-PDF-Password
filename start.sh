#!/bin/bash
# PQC Demo - Start Script
# Jalankan: ./start.sh

echo "🔮 Starting PQC Demo - Grover's Algorithm vs PDF Password"
echo "==========================================================="
echo ""

# Start backend
echo "🐍 Starting Backend (FastAPI)..."
cd backend
source venv/bin/activate
python run.py &
BACKEND_PID=$!
cd ..

# Wait for backend to be ready
echo "⏳ Waiting for backend..."
sleep 3

# Start frontend
echo "⚛️  Starting Frontend (Vite)..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "==========================================================="
echo "✅ PQC Demo is running!"
echo ""
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "   Press Ctrl+C to stop"
echo "==========================================================="

# Wait for interrupt
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo ''; echo '👋 Stopped.'; exit 0" INT TERM
wait
