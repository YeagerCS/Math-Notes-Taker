#!/usr/bin/env bash
# Manual backend deploy from your machine to the Raspberry Pi (no GitHub needed).
#   ./deploy/deploy-pi.sh
# The frontend is deployed separately to GitHub Pages (Actions → "Deploy frontend to GitHub Pages").
set -euo pipefail

HOST="${PI_HOST:-raspberry}"
REMOTE_DIR="${PI_DIR:-mathnotes/src}"

cd "$(dirname "$0")/.."

echo "→ Uploading sources to $HOST:~/$REMOTE_DIR"
ssh "$HOST" "rm -rf ~/$REMOTE_DIR && mkdir -p ~/$REMOTE_DIR"
tar --exclude=node_modules --exclude=dist --exclude='.env*' -cf - backend deploy \
  | ssh "$HOST" "tar -xf - -C ~/$REMOTE_DIR"

ssh "$HOST" REMOTE_DIR="$REMOTE_DIR" 'bash -s' <<'REMOTE'
set -euo pipefail
cd ~/"$REMOTE_DIR"
echo "→ Building mathnotes-api"
docker build -q -t mathnotes-api:latest backend
echo "→ Restarting api"
docker compose -p mathnotes -f deploy/docker-compose.yml up -d --remove-orphans

echo "→ Health check"
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3100/api/health >/dev/null; then
    echo "✓ API up on :3100 (public: https://api.malisi.ch)"
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 2
done
docker compose -p mathnotes -f deploy/docker-compose.yml logs --tail 40
exit 1
REMOTE
