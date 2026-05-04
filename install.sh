#!/bin/bash
set -e

CYAN='\033[0;36m'
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'

echo -e "
${BOLD}${CYAN}╔═══════════════════════════════════════════════════╗
║        CS2 Server Play Button — Installer          ║
╚═══════════════════════════════════════════════════╝${RESET}
"

# Check Docker is installed
if ! command -v docker &>/dev/null; then
  echo -e "${RED}✗  Docker is not installed.${RESET}"
  echo -e "${YELLOW}   Get it at: https://docs.docker.com/get-docker/${RESET}"
  exit 1
fi

# Check Docker daemon is running
if ! docker info &>/dev/null; then
  echo -e "${RED}✗  Docker daemon is not running. Please start Docker and try again.${RESET}"
  exit 1
fi

IMAGE="ghcr.io/beaudenison/cs2-server-play-button:latest"
CONTAINER="cs2-play-button"
VOLUME="cs2bot_data"

echo -e "${YELLOW}  ➜  Pulling latest image...${RESET}"
docker pull "$IMAGE"

# Remove old container if it exists
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo -e "${YELLOW}  ➜  Removing existing container...${RESET}"
  docker rm -f "$CONTAINER"
fi

echo -e "${GREEN}${BOLD}
✔  Ready! Starting setup wizard...${RESET}
"

docker run -it \
  --name "$CONTAINER" \
  --restart unless-stopped \
  -v "${VOLUME}:/data" \
  "$IMAGE"
