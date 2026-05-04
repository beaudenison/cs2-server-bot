# CS2 Server Play Button — Discord Bot

A self-hosted Discord bot that lets your community see your CS2 server's live status and join with a single click.

No cloning required. Everything runs from a pre-built Docker image.

---

## Features

- **One-command setup** — run one Docker command and an interactive wizard walks you through everything
- `/setup` slash command posts a live server status panel to any channel
- Live embed showing server name, current map, and player count
- **🟢 Join Server** button that opens CS2 and auto-connects (`steam://connect/…`)
- Embed auto-refreshes every **30 seconds**
- Shows offline state when the server is unreachable

---

## Requirements

- [Docker](https://docs.docker.com/get-docker/) with the Compose plugin

---

## Setup — two steps, one command

### Step 1 — Copy this `docker-compose.yml` anywhere on your machine

```yaml
services:
  cs2-bot:
    image: ghcr.io/beaudenison/cs2-server-play-button:latest
    container_name: cs2-play-button
    restart: unless-stopped
    stdin_open: true
    tty: true
    volumes:
      - cs2bot_data:/data

volumes:
  cs2bot_data:
```

### Step 2 — Run the setup wizard

```bash
docker compose run --rm cs2-bot
```

Docker pulls the image and launches an interactive wizard that will:

1. Walk you through creating a Discord Application at <https://discord.com/developers/applications>
2. Prompt for your **Application ID** and **Bot Token**
3. Explain how to enable required intents
4. Generate a one-click invite URL to add the bot to your server

After finishing the wizard the bot starts automatically. Your credentials are saved in a named Docker volume — the wizard won't appear again.

---

## Running after initial setup

```bash
docker compose up -d
```

---

## Configure your CS2 server

Once the bot is online in your Discord server, run `/setup` in any channel and fill in the modal:

| Field | Example |
|-------|---------|
| Server IP | `123.45.67.89` |
| Server Port | `27015` |
| RCON Password | `mysecret` (optional) |

Hit **Submit** — the live status panel is posted immediately.

---

## Updating

```bash
docker compose pull && docker compose up -d
```