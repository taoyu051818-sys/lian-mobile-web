#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/lian-mobile-web}"
PORT="${PORT:-4100}"

sudo mkdir -p "$APP_DIR"
sudo rsync -a --delete --exclude ".git" ./ "$APP_DIR/"
sudo chown -R "$USER":"$USER" "$APP_DIR"

cd "$APP_DIR"
export PORT="$PORT"
if pm2 describe lian-mobile-web >/dev/null 2>&1; then
  pm2 reload lian-mobile-web --update-env
else
  pm2 start server.js --name lian-mobile-web --update-env
fi

pm2 save

cat <<EOF
App is running on http://127.0.0.1:$PORT
First visit will show the setup guide if .env is missing.

Nginx reverse proxy example:

server {
  listen 80;
  server_name your-domain.com;

  location / {
    proxy_pass http://127.0.0.1:$PORT;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
  }
}
EOF
