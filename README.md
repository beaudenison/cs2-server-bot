# CS2 Server Play Button — Discord Bot

A self-hosted Discord bot that posts a live CS2 status panel in Discord with a join button.

No cloning required. Everything runs from a pre-built Docker image.

---

## Features

- One-command install and update via `curl | bash`
- Interactive Docker installer asks for Discord App ID + Bot Token
- `/setup` creates a live status panel in the channel where you run it
- Setup modal fields:
	- Server Address (`IP:PORT`)
	- RCON Password (required)
	- Join Link URL (required, your Dub short link)
- Status panel shows:
	- Server name
	- Total players
	- Join Server button
- Auto-refresh every 30 seconds
- Fallback query logic: GameDig first, RCON `status` fallback if needed

---

## Requirements

- [Docker](https://docs.docker.com/get-docker/)

---

## Setup — one command

```bash
curl -fsSL https://raw.githubusercontent.com/beaudenison/cs2-server-play-button/main/install.sh | bash
```

That's it. The script will:
1. Pull the Docker image automatically
2. Launch an installer wizard for Discord bot credentials
3. Prompt for your **Application ID** and **Bot Token**
4. Start the bot container (`cs2-play-button`)

The bot persists data in Docker volume `cs2bot_data`.

---

## Discord Server Setup (`/setup`)

After the bot is online, run `/setup` in your Discord server.

Step 1: Read the ephemeral instructions and click **Open Setup Form**.

Step 2: Fill the modal:

| Field | Required | Example |
|---|---|---|
| Server Address (IP:PORT) | Yes | `123.45.67.89:27015` |
| RCON Password | Yes | `my-rcon-password` |
| Join Link URL | Yes | `https://dub.sh/your-link` |

Step 3: Submit. The bot posts a live panel in that channel.

### How to create the Join Link URL

1. Go to [https://app.dub.co](https://app.dub.co)
2. Create a short link
3. Set destination URL to this exact format:

```text
steam://run/730//+connect <IP:PORT>
```

Example:

```text
steam://run/730//+connect 123.45.67.89:27015
```

---

## Running after a reboot / restart

```bash
docker start cs2-play-button
```

---

## Updating

```bash
curl -fsSL https://raw.githubusercontent.com/beaudenison/cs2-server-play-button/main/install.sh | bash
```

Your credentials and server config are preserved in the Docker volume.

---

## Useful Commands

```bash
docker logs -f cs2-play-button
docker restart cs2-play-button
docker rm -f cs2-play-button
```