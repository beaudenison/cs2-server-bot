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

## Setup — one command

```bash
docker run -it --name cs2-play-button --restart unless-stopped -v cs2bot_data:/data ghcr.io/beaudenison/cs2-server-play-button:latest
```

Docker pulls the image and immediately launches an interactive wizard that will:

1. Walk you through creating a Discord Application at <https://discord.com/developers/applications>
2. Prompt for your **Application ID** and **Bot Token**
3. Explain how to enable required intents
4. Generate a one-click invite URL to add the bot to your server

After the wizard the bot starts automatically inside the same container. Your credentials are saved in the `cs2bot_data` Docker volume — the wizard won't appear again on restarts.

---

## Running after a reboot / restart

```bash
docker start cs2-play-button
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
docker stop cs2-play-button && docker rm cs2-play-button
docker pull ghcr.io/beaudenison/cs2-server-play-button:latest
docker run -it --name cs2-play-button --restart unless-stopped -v cs2bot_data:/data ghcr.io/beaudenison/cs2-server-play-button:latest
```