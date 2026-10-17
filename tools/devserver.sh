#!/bin/bash
# Ensure the shared Vite dev server is up on :5300 (idempotent, detached). Usage: tools/devserver.sh [stop|status]
cd "$(dirname "$0")/.." || exit 1
PORT=5300
case "${1:-ensure}" in
  stop) pkill -f "vite --port $PORT" && echo stopped || echo "not running"; exit 0 ;;
  status) curl -s -o /dev/null -m 2 "http://127.0.0.1:$PORT/" && echo up || echo down; exit 0 ;;
esac
if curl -s -o /dev/null -m 2 "http://127.0.0.1:$PORT/"; then echo "dev server up on :$PORT"; exit 0; fi
mkdir -p .locks
nohup npx vite --port $PORT --strictPort > .locks/devserver.log 2>&1 &
for i in $(seq 1 60); do
  if curl -s -o /dev/null -m 2 "http://127.0.0.1:$PORT/"; then echo "dev server started on :$PORT"; exit 0; fi
  sleep 0.5
done
echo "dev server failed to start; see .locks/devserver.log"; tail -20 .locks/devserver.log; exit 1
