#!/bin/bash

CYAN='\033[0;36m'
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
RESET='\033[0m'

echo -e "
${BOLD}${CYAN}╔═══════════════════════════════════════════════════╗
║        CS2 Server Play Button — Setup Wizard       ║
╚═══════════════════════════════════════════════════╝${RESET}
"

# ── Check Docker ──────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo -e "${RED}✗  Docker is not installed.${RESET}"
  echo -e "${YELLOW}   Get it at: https://docs.docker.com/get-docker/${RESET}"
  exit 1
fi
if ! docker info &>/dev/null; then
  echo -e "${RED}✗  Docker daemon is not running. Please start Docker and try again.${RESET}"
  exit 1
fi

IMAGE="ghcr.io/beaudenison/cs2-server-play-button:latest"
CONTAINER="cs2-play-button"
VOLUME="cs2bot_data"

step()    { echo -e "\n${BOLD}${BLUE}[ Step $1 ] $2${RESET}"; }
info()    { echo -e "${YELLOW}  ➜  $1${RESET}"; }
success() { echo -e "\n${GREEN}${BOLD}✔  $1${RESET}"; }

ask() {
  # Write prompt directly to terminal, read answer directly from terminal
  echo -en "\n${BOLD}$1${RESET} " > /dev/tty
  read -r REPLY < /dev/tty
}

ask_secret() {
  echo -en "\n${BOLD}$1${RESET} " > /dev/tty
  read -rs REPLY < /dev/tty
  echo "" > /dev/tty
}

confirm() {
  local ans
  while true; do
    echo -en "\n${BOLD}$1 [Y/n]${RESET} " > /dev/tty
    read -r ans < /dev/tty
    case "$ans" in
      ""|y|Y|yes|YES) return ;;
    esac
  done
}

# ── Check if already configured ───────────────────────────────────────────────
TMPDIR_CHECK=$(mktemp -d)
docker volume create "$VOLUME" &>/dev/null
docker run --rm -v "${VOLUME}:/data" -v "${TMPDIR_CHECK}:/out" alpine \
  sh -c 'cp /data/.env /out/.env 2>/dev/null || true' 2>/dev/null || true
EXISTING_TOKEN=$(grep -s 'DISCORD_TOKEN' "${TMPDIR_CHECK}/.env" | cut -d= -f2)
rm -rf "$TMPDIR_CHECK"

if [ -n "$EXISTING_TOKEN" ]; then
  echo -e "${GREEN}${BOLD}✔  Existing configuration found — skipping wizard.${RESET}"
else
  # ── Step 1 ───────────────────────────────────────────────────────────────
  step 1 "Create a Discord Application"
  info "Open this URL in your browser:"
  echo -e "\n  ${CYAN}https://discord.com/developers/applications${RESET}\n"
  info 'Click "New Application" and give it a name (e.g. CS2 Play Button).'
  info 'On the General Information page you will see your APPLICATION ID.'

  APP_ID=""
  while true; do
    ask "Paste your Application ID:"
    APP_ID="$REPLY"
    if echo "$APP_ID" | grep -qE '^[0-9]{17,20}$'; then break; fi
    echo -e "${RED}  ✗  Should be 17-20 digits. Try again.${RESET}" > /dev/tty
  done

  # ── Step 2 ───────────────────────────────────────────────────────────────
  step 2 "Create a Bot user and get its token"
  info 'In the left sidebar click "Bot".'
  info 'Click "Add Bot" → "Yes, do it!"'
  info 'Under Token click "Reset Token", confirm, then copy it.'

  TOKEN=""
  while true; do
    ask_secret "Paste your Bot Token (input hidden):"
    TOKEN="$REPLY"
    if [ ${#TOKEN} -gt 20 ]; then break; fi
    echo -e "${RED}  ✗  Token looks too short — double-check it.${RESET}" > /dev/tty
  done

  # ── Step 3 ───────────────────────────────────────────────────────────────
  step 3 "Enable required Privileged Gateway Intents"
  info 'Still on the Bot page, scroll to "Privileged Gateway Intents".'
  info "Toggle ON: SERVER MEMBERS INTENT"
  info "Toggle ON: MESSAGE CONTENT INTENT"
  info 'Click "Save Changes".'
  confirm "Done?"

  # ── Step 4 ───────────────────────────────────────────────────────────────
  step 4 "Invite the bot to your Discord server"
  INVITE_URL="https://discord.com/oauth2/authorize?client_id=${APP_ID}&permissions=2147485696&scope=bot%20applications.commands"
  info "Open this invite URL in your browser:"
  echo -e "\n  ${BOLD}${CYAN}${INVITE_URL}${RESET}\n"
  info "Select your server and click Authorise."
  confirm "Bot has been invited?"

  # ── Save credentials to a host temp file then copy into volume ────────────
  TMPENV=$(mktemp)
  printf 'DISCORD_TOKEN=%s\nDISCORD_APP_ID=%s\n' "$TOKEN" "$APP_ID" > "$TMPENV"
  docker run --rm \
    -v "${VOLUME}:/data" \
    -v "${TMPENV}:/tmp/env_input:ro" \
    alpine sh -c 'cp /tmp/env_input /data/.env && chmod 600 /data/.env'
  rm -f "$TMPENV"

  success "Credentials saved!"
fi

# ── Pull & start ──────────────────────────────────────────────────────────────
echo -e "\n${YELLOW}  ➜  Pulling latest image...${RESET}"
docker pull "$IMAGE"

if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  docker rm -f "$CONTAINER" &>/dev/null
fi

docker run -d \
  --name "$CONTAINER" \
  --restart unless-stopped \
  -v "${VOLUME}:/data" \
  "$IMAGE"

echo -e "
${GREEN}${BOLD}✔  Bot is running!${RESET}
${YELLOW}  ➜  Go to your Discord server and run /setup to post the server panel.${RESET}
${YELLOW}  ➜  View logs:  docker logs -f ${CONTAINER}${RESET}
${YELLOW}  ➜  Restart:    docker restart ${CONTAINER}${RESET}
"
