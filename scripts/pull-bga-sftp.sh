#!/usr/bin/env bash
# Pull the BGA project folder from the SFTP server to a local snapshot.
# Requires lftp (brew install lftp).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

# Load minimal environment
if [[ -f "$ENV_FILE" ]]; then
  while IFS= read -r line; do
    [[ -z "$line" || "$line" =~ ^\s*# ]] && continue
    if [[ "$line" =~ ^(BGA_SFTP_HOST|BGA_SFTP_PORT|BGA_SFTP_USER|BGA_SFTP_PASSWORD|BGA_SFTP_REMOTE_DIR|BGA_DB_USER)= ]]; then
      key="${line%%=*}"
      val="${line#*=}"
      export "$key=$val"
    fi
  done < "$ENV_FILE"
fi

# Expand ${BGA_DB_USER} placeholder in remote dir
if [[ -n "${BGA_SFTP_REMOTE_DIR:-}" && -n "${BGA_DB_USER:-}" ]]; then
  BGA_SFTP_REMOTE_DIR="${BGA_SFTP_REMOTE_DIR//\$\{BGA_DB_USER\}/$BGA_DB_USER}"
fi

# Local target snapshot folder
LOCAL_SNAPSHOT="$ROOT_DIR/bga-windwalkers-remote"
mkdir -p "$LOCAL_SNAPSHOT"

# Check for lftp
if ! command -v lftp >/dev/null 2>&1; then
  echo "lftp not found. Please install it (e.g., brew install lftp) and retry." >&2
  exit 1
fi

EXCLUDES=(
  "node_modules"
  ".git"
  ".DS_Store"
  "vendor"
  ".venv"
  ".next/cache"
  ".phpunit.result.cache"
  ".*"
)
excludeFlags=()
for e in "${EXCLUDES[@]}"; do
  excludeFlags+=("--exclude-glob" "$e")
done

echo "Pulling remote folder '$BGA_SFTP_REMOTE_DIR' from '$BGA_SFTP_USER@$BGA_SFTP_HOST' into '$LOCAL_SNAPSHOT'"

lftp -u "$BGA_SFTP_USER","$BGA_SFTP_PASSWORD" "sftp://$BGA_SFTP_HOST:$BGA_SFTP_PORT" <<EOF
set net:max-retries 2
set net:timeout 30
set sftp:auto-confirm yes
set cmd:fail-exit yes
lcd "$LOCAL_SNAPSHOT"
cd "$BGA_SFTP_REMOTE_DIR"
mirror --parallel=4 --delete ${excludeFlags[@]}
bye
EOF

echo "SFTP pull complete: $LOCAL_SNAPSHOT"