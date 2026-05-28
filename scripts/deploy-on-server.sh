#!/usr/bin/env bash
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/softeng789}"
RELEASE_SHA="${RELEASE_SHA:?RELEASE_SHA is required}"
RELEASE_DIR="$DEPLOY_PATH/releases/$RELEASE_SHA"
SHARED_DIR="$DEPLOY_PATH/shared"
ENV_FILE="$SHARED_DIR/.env.production"
COMPOSE_FILE="docker-compose.prod.yml"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed on the server."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is not installed on the server."
  exit 1
fi

if [ ! -d "$RELEASE_DIR" ]; then
  echo "Release directory does not exist: $RELEASE_DIR"
  exit 1
fi

mkdir -p "$SHARED_DIR"

if [ ! -f "$ENV_FILE" ]; then
  cat > "$SHARED_DIR/.env.production.example" <<'EOF'
JWT_SECRET=replace-with-a-long-random-secret
APP_HOST=203-0-113-10.sslip.io

TEACHER_EMAIL=teacher@example.com
TEACHER_PASSWORD=replace-with-teacher-password

EMAIL_HOST=smtp.qq.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=your-sender@example.com
EMAIL_PASS=replace-with-smtp-authorization-code
EMAIL_FROM=TBL Test System <your-sender@example.com>
EOF
  echo "Missing $ENV_FILE"
  echo "Create it on the server first. A template was written to $SHARED_DIR/.env.production.example"
  exit 1
fi

ln -sfn "$ENV_FILE" "$RELEASE_DIR/.env.production"

cd "$RELEASE_DIR"

docker compose -f "$COMPOSE_FILE" build
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

ln -sfn "$RELEASE_DIR" "$DEPLOY_PATH/current"

ls -dt "$DEPLOY_PATH/releases"/*/ 2>/dev/null | tail -n +6 | xargs -r rm -rf
docker image prune -f
