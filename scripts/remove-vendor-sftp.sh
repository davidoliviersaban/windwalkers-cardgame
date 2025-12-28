#!/usr/bin/env bash
# Remove vendor directory from remote BGA server
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

# Load environment variables
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

# Expand placeholder
if [[ -n "${BGA_SFTP_REMOTE_DIR:-}" && -n "${BGA_DB_USER:-}" ]]; then
  BGA_SFTP_REMOTE_DIR="${BGA_SFTP_REMOTE_DIR//\$\{BGA_DB_USER\}/$BGA_DB_USER}"
  export BGA_SFTP_REMOTE_DIR
fi

# Validate required variables
: "${BGA_SFTP_HOST:?BGA_SFTP_HOST is required}"
: "${BGA_SFTP_PORT:?BGA_SFTP_PORT is required}"
: "${BGA_SFTP_USER:?BGA_SFTP_USER is required}"
: "${BGA_SFTP_PASSWORD:?BGA_SFTP_PASSWORD is required}"
: "${BGA_SFTP_REMOTE_DIR:?BGA_SFTP_REMOTE_DIR is required}"

# Check for lftp
if ! command -v lftp >/dev/null 2>&1; then
  echo "lftp not found. Please install it (e.g., brew install lftp) and retry." >&2
  exit 1
fi

echo "Removing vendor directory from remote: '$BGA_SFTP_USER@$BGA_SFTP_HOST:$BGA_SFTP_REMOTE_DIR' (port $BGA_SFTP_PORT)"

# Prepare relative remote dir
REMOTE_DIR_PREFIX="/home/studio/$BGA_DB_USER/"
if [[ "$BGA_SFTP_REMOTE_DIR" == "$REMOTE_DIR_PREFIX"* ]]; then
  REMOTE_DIR_REL="${BGA_SFTP_REMOTE_DIR#"$REMOTE_DIR_PREFIX"}"
else
  REMOTE_DIR_REL="$BGA_SFTP_REMOTE_DIR"
fi
REMOTE_DIR_REL="${REMOTE_DIR_REL#/}"

# Remove vendor directory
lftp -u "$BGA_SFTP_USER","$BGA_SFTP_PASSWORD" "sftp://$BGA_SFTP_HOST:$BGA_SFTP_PORT" <<EOF
set net:max-retries 2
set net:timeout 30
set sftp:auto-confirm yes
set cmd:fail-exit yes
cd ~
cd "$REMOTE_DIR_REL"
rm -rf vendor
bye
EOF

echo "Vendor directory removed from remote server."
