set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Starting Verba..."

# Backend
echo "  Starting backend on :8000..."
cd "$SCRIPT_DIR/backend"
source venv/bin/activate
uvicorn app.main:app --port 8000 --reload &
BACKEND_PID=$!

# Frontend
echo "  Starting frontend on :5173..."
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:5173"
echo ""
echo "  Press Ctrl+C to stop both servers"

# Cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
