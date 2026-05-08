#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${LIAN_PREVIEW_PORT:-4301}"
LOG_FILE="${LIAN_PREVIEW_LOG:-/tmp/lian-vue-canary-preview.log}"

cd "$ROOT_DIR"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[preview] not inside a git checkout: $ROOT_DIR" >&2
  exit 1
fi

BRANCH="$(git branch --show-current || true)"
COMMIT="$(git rev-parse HEAD)"

if [[ -z "$BRANCH" ]]; then
  BRANCH="detached"
fi

echo "[preview] checkout: $BRANCH @ $COMMIT"
echo "[preview] installing dependencies"
npm ci

echo "[preview] building dist"
npm run build

mkdir -p dist
cat > dist/build-commit.txt <<EOF
commit=$COMMIT
branch=$BRANCH
built_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
builder=manual-branch-preview
EOF

echo "[preview] build marker"
cat dist/build-commit.txt

OLD_PID="$(ss -ltnp 2>/dev/null | awk -v port=":$PORT" '$0 ~ port {print $NF}' | sed -E 's/.*pid=([0-9]+).*/\1/' | head -1 || true)"
if [[ -n "$OLD_PID" ]]; then
  echo "[preview] stopping existing process on port $PORT: $OLD_PID"
  kill "$OLD_PID" || true
  sleep 2
fi

if ss -ltnp 2>/dev/null | grep -q ":$PORT"; then
  echo "[preview] port $PORT is still occupied" >&2
  ss -ltnp | grep ":$PORT" >&2 || true
  exit 1
fi

echo "[preview] starting vite preview on port $PORT"
nohup npm run preview:vue-canary > "$LOG_FILE" 2>&1 &
PREVIEW_PID="$!"

sleep 3

if ! ss -ltnp 2>/dev/null | grep -q ":$PORT"; then
  echo "[preview] preview did not start on port $PORT" >&2
  tail -80 "$LOG_FILE" >&2 || true
  exit 1
fi

echo "[preview] preview pid: $PREVIEW_PID"
echo "[preview] listening:"
ss -ltnp | grep ":$PORT" || true

echo "[preview] health probe:"
curl -I "http://127.0.0.1:$PORT/" || true

echo "[preview] log tail: $LOG_FILE"
tail -40 "$LOG_FILE" || true
