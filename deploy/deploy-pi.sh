#!/usr/bin/env bash
# Manual deploy from your machine to the Raspberry Pi (no GitHub needed).
#   ./deploy/deploy-pi.sh            # deploy api + web
#   ./deploy/deploy-pi.sh api        # only the backend
#   ./deploy/deploy-pi.sh web        # only the frontend
set -euo pipefail

HOST="${PI_HOST:-raspberry}"
REMOTE_DIR="${PI_DIR:-mathnotes/src}"
TARGETS="${1:-all}"

cd "$(dirname "$0")/.."

echo "→ Uploading sources to $HOST:~/$REMOTE_DIR"
ssh "$HOST" "rm -rf ~/$REMOTE_DIR && mkdir -p ~/$REMOTE_DIR"
tar --exclude=node_modules --exclude=dist --exclude='.env*' -cf - backend frontend deploy \
  | ssh "$HOST" "tar -xf - -C ~/$REMOTE_DIR"

ssh "$HOST" TARGETS="$TARGETS" REMOTE_DIR="$REMOTE_DIR" 'bash -s' <<'REMOTE'
set -euo pipefail
cd ~/"$REMOTE_DIR"
services=()
if [[ "$TARGETS" == all || "$TARGETS" == api ]]; then
  echo "→ Building mathnotes-api"
  docker build -q -t mathnotes-api:latest backend
  services+=(api)
fi
if [[ "$TARGETS" == all || "$TARGETS" == web ]]; then
  echo "→ Building mathnotes-web"
  docker build -q -t mathnotes-web:latest frontend
  services+=(web)
fi
echo "→ Restarting ${services[*]}"
docker compose -p mathnotes -f deploy/docker-compose.yml up -d --no-deps "${services[@]}"

echo "→ Health check"
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8092/api/health >/dev/null; then
    echo "✓ Up: http://$(hostname -I | awk '{print $1}'):8092"
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 2
done
docker compose -p mathnotes -f deploy/docker-compose.yml logs --tail 40
exit 1
REMOTE
