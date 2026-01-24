#!/usr/bin/env bash
# Deploy the selected source folder to a remote SFTP server (e.g., BGA Studio).
# Requires lftp (Homebrew: brew install lftp).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

# Load only the variables we need from .env, preserving spaces and special chars
if [[ -f "$ENV_FILE" ]]; then
  while IFS= read -r line; do
    # skip comments and empty lines
    [[ -z "$line" || "$line" =~ ^\s*# ]] && continue
    if [[ "$line" =~ ^(BGA_SFTP_HOST|BGA_SFTP_PORT|BGA_SFTP_USER|BGA_SFTP_PASSWORD|BGA_SFTP_REMOTE_DIR|DEPLOY_SOURCE|BGA_DB_USER)= ]]; then
      key="${line%%=*}"
      val="${line#*=}"
      export "$key=$val"
    fi
  done < "$ENV_FILE"
fi

# Expand placeholder ${BGA_DB_USER} inside BGA_SFTP_REMOTE_DIR if present
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

# Always deploy the BGA game folder only
LOCAL_PATH="$ROOT_DIR/bga-windwalkers"

if [[ ! -d "$LOCAL_PATH" ]]; then
  echo "Local deploy source not found: $LOCAL_PATH" >&2
  exit 1
fi

# Check for lftp
if ! command -v lftp >/dev/null 2>&1; then
  echo "lftp not found. Please install it (e.g., brew install lftp) and retry." >&2
  exit 1
fi

# Exclude common heavy or generated folders/files
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

# Support optional --dry-run argument
DRY_RUN_FLAG=""
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN_FLAG="--dry-run"
fi

echo "Deploying 'bga-windwalkers' from '$LOCAL_PATH' to '$BGA_SFTP_USER@$BGA_SFTP_HOST:$BGA_SFTP_REMOTE_DIR' (port $BGA_SFTP_PORT)"

# Prepare relative remote dir for creation steps (assumes login starts at user home)
REMOTE_DIR_PREFIX="/home/studio/$BGA_DB_USER/"
if [[ "$BGA_SFTP_REMOTE_DIR" == "$REMOTE_DIR_PREFIX"* ]]; then
  REMOTE_DIR_REL="${BGA_SFTP_REMOTE_DIR#"$REMOTE_DIR_PREFIX"}"
else
  REMOTE_DIR_REL="$BGA_SFTP_REMOTE_DIR"
fi
# strip any leading '/'
REMOTE_DIR_REL="${REMOTE_DIR_REL#/}"

# First, pull a snapshot of the remote folder locally (per BGA docs)
LOCAL_SNAPSHOT="$ROOT_DIR/bga-windwalkers-remote"
mkdir -p "$LOCAL_SNAPSHOT"

# echo "Pulling remote folder '$BGA_SFTP_REMOTE_DIR' into '$LOCAL_SNAPSHOT' before deployment"
# lftp -u "$BGA_SFTP_USER","$BGA_SFTP_PASSWORD" "sftp://$BGA_SFTP_HOST:$BGA_SFTP_PORT" <<EOF
# set net:max-retries 2
# set net:timeout 30
# set sftp:auto-confirm yes
# set cmd:fail-exit yes
# lcd "$LOCAL_SNAPSHOT"
# cd ~
# cd "$REMOTE_DIR_REL"
# mirror --parallel=4 --delete ${excludeFlags[@]}
# bye
# EOF

# Execute lftp mirror reverse (upload)
lftp -u "$BGA_SFTP_USER","$BGA_SFTP_PASSWORD" "sftp://$BGA_SFTP_HOST:$BGA_SFTP_PORT" <<EOF
set net:max-retries 2
set net:timeout 30
set sftp:auto-confirm yes
set cmd:fail-exit yes
lcd "$LOCAL_PATH"
# Ensure remote directory exists (create parents when possible)
cd ~
cd "$REMOTE_DIR_REL"
mirror -R --parallel=4 --delete $DRY_RUN_FLAG ${excludeFlags[@]}
bye
EOF

echo "SFTP deployment complete."