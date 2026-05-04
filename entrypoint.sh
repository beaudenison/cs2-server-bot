#!/bin/sh
set -e

# Ensure data directory exists (named volume)
mkdir -p /data

# Source persisted .env so we can inspect DISCORD_TOKEN
if [ -f /data/.env ]; then
  # shellcheck disable=SC1091
  set -a
  . /data/.env
  set +a
fi

# If no token is configured yet, run the interactive setup wizard
if [ -z "$DISCORD_TOKEN" ]; then
  node install.js
fi

exec node bot.js
