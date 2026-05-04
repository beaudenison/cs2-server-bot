'use strict';

require('dotenv').config({ path: '/data/.env' });

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  InteractionType,
  MessageFlags,
} = require('discord.js');

const { GameDig } = require('gamedig');
const { Rcon } = require('rcon-client');
const fs = require('fs');

function buildJoinUrl(host, port) {
  return 'https://app.dub.co';
}

// ── Persistence (stores server config + live message refs per guild) ────────
const DATA_FILE = '/data/data.json';

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ── Query a CS2 server via Source query protocol ────────────────────────────
async function queryServer(host, port) {
  const queryPort = Number(port);
  const portsToTry = [queryPort, queryPort + 1];
  const typesToTry = ['cs2', 'csgo'];
  let result;
  let lastError;

  // Some providers expose query on game port + 1, and some respond only to csgo type.
  for (const gameType of typesToTry) {
    for (const p of portsToTry) {
      try {
        result = await GameDig.query({
          type: gameType,
          host,
          port: p,
          requestRules: false,
          socketTimeout: 3000,
          attemptTimeout: 5000,
          maxAttempts: 2,
        });
        break;
      } catch (err) {
        lastError = err;
      }
    }
    if (result) break;
  }

  if (!result) {
    throw lastError || new Error('Server query failed');
  }

  const players = Array.isArray(result.players)
    ? result.players.length
    : Number(result.numplayers ?? result?.raw?.numplayers ?? 0);
  const maxPlayers = Number(
    result.maxplayers ?? result.maxPlayers ?? result?.raw?.maxplayers ?? 0,
  );

  return {
    name: String(result.name || result?.raw?.name || 'Unknown Server'),
    map: String(result.map || result?.raw?.map || 'Unknown Map'),
    players: Number.isFinite(players) ? players : 0,
    maxPlayers: Number.isFinite(maxPlayers) ? maxPlayers : 0,
    raw: result,
  };
}

function parseRconStatus(statusText, host, port) {
  // Strip ANSI escape codes/control chars some servers include in RCON output.
  const clean = String(statusText || '')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/\r/g, '');

  const hostnameMatch = clean.match(/hostname\s*:\s*(.+)/i);
  const mapMatch = clean.match(/map\s*:\s*([^\s]+)/i);

  const playersMaxMatch =
    clean.match(/players\s*:\s*(\d+)\s*humans?.*?\((\d+)\s*max\)/i) ||
    clean.match(/players\s*:\s*(\d+)\s*\((\d+)\s*max\)/i) ||
    clean.match(/players\s*:\s*(\d+)\s*\/\s*(\d+)/i);

  // Fallback: count scoreboard lines like "# 2 123456... playername ..."
  const scoreboardPlayers = (clean.match(/^#\s+\d+\s+\d+/gm) || []).length;

  const name = hostnameMatch?.[1]?.trim() || `CS2 Server (${host}:${port})`;
  const map = mapMatch?.[1]?.trim() || 'Unknown Map';
  const players = playersMaxMatch ? Number(playersMaxMatch[1]) : scoreboardPlayers;
  const maxPlayers = playersMaxMatch ? Number(playersMaxMatch[2]) : 0;

  return {
    name,
    map,
    players,
    maxPlayers,
    raw: { source: 'rcon', statusText: clean },
  };
}

async function queryViaRcon(host, port, rconPassword) {
  if (!rconPassword) {
    throw new Error('No RCON password configured for fallback');
  }

  const rcon = await Rcon.connect({
    host,
    port: Number(port),
    password: rconPassword,
    timeout: 5000,
  });

  try {
    const statusText = await rcon.send('status');
    return parseRconStatus(String(statusText || ''), host, port);
  } finally {
    await rcon.end().catch(() => {});
  }
}

async function queryServerWithFallback(host, port, rconPassword) {
  try {
    return await queryServer(host, port);
  } catch (gameDigErr) {
    try {
      return await queryViaRcon(host, port, rconPassword);
    } catch (rconErr) {
      throw new Error(
        `GameDig failed (${gameDigErr?.message || gameDigErr}); RCON failed (${rconErr?.message || rconErr})`
      );
    }
  }
}

// ── Build the live server status embed ──────────────────────────────────────
function buildServerEmbed(info, host, port, joinUrl) {
  const connectUrl = joinUrl || buildJoinUrl(host, port);

  const embed = new EmbedBuilder()
    .setTitle('🖥️  CS2 Server Status')
    .setColor(0x00b300)
    .addFields(
      { name: '🏷️  Server Name', value: info.name, inline: false },
      {
        name: '👥  Total Players',
        value: `${info.players}`,
        inline: true,
      },
    )
    .setFooter({ text: 'Updates every 30 seconds' })
    .setTimestamp();

  const joinButton = new ButtonBuilder()
    .setLabel('🟢  Join Server')
    .setStyle(ButtonStyle.Link)
    .setURL(connectUrl);

  const row = new ActionRowBuilder().addComponents(joinButton);

  return { embeds: [embed], components: [row] };
}

// ── Build an offline embed ───────────────────────────────────────────────────
function buildOfflineEmbed(host, port, joinUrl) {
  const connectUrl = joinUrl || buildJoinUrl(host, port);

  const embed = new EmbedBuilder()
    .setTitle('🖥️  CS2 Server Status')
    .setColor(0xff0000)
    .setDescription('❌  Server is offline or unreachable.')
    .setFooter({ text: 'Updates every 30 seconds' })
    .setTimestamp();

  const joinButton = new ButtonBuilder()
    .setLabel('🔴  Server Offline')
    .setStyle(ButtonStyle.Link)
    .setURL(connectUrl)
    .setDisabled(true);

  const row = new ActionRowBuilder().addComponents(joinButton);

  return { embeds: [embed], components: [row] };
}

function buildSetupModal() {
  const modal = new ModalBuilder()
    .setCustomId('cs2_setup_modal')
    .setTitle('CS2 Server Setup');

  const addressInput = new TextInputBuilder()
    .setCustomId('cs2_address')
    .setLabel('Server Address (IP:PORT)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 123.45.67.89:27015')
    .setRequired(true);

  const rconInput = new TextInputBuilder()
    .setCustomId('cs2_rcon')
    .setLabel('RCON Password (required)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Your CS2 server RCON password')
    .setRequired(true);

  const joinLinkInput = new TextInputBuilder()
    .setCustomId('cs2_join_link')
    .setLabel('Join Link URL (required)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Paste your Dub short link (https://...)')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(addressInput),
    new ActionRowBuilder().addComponents(rconInput),
    new ActionRowBuilder().addComponents(joinLinkInput),
  );

  return modal;
}

// ── Slash command definition ─────────────────────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure your CS2 server and post a live status panel')
    .toJSON(),
];

// ── Bot client ───────────────────────────────────────────────────────────────
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

client.once('clientReady', async () => {
  console.log(`✅  Logged in as ${client.user.tag}`);

  // Register slash commands globally
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(process.env.DISCORD_APP_ID), {
      body: commands,
    });
    console.log('✅  Slash commands registered globally');
  } catch (err) {
    console.error('Failed to register commands:', err);
  }

  // Start the background refresh loop
  startRefreshLoop();
});

// ── Background refresh every 30 s ───────────────────────────────────────────
function startRefreshLoop() {
  setInterval(async () => {
    const data = loadData();
    for (const [guildId, config] of Object.entries(data)) {
      if (!config.host || !config.port || !config.messageId || !config.channelId) continue;
      try {
        const channel = await client.channels.fetch(config.channelId).catch(() => null);
        if (!channel) continue;
        const message = await channel.messages.fetch(config.messageId).catch(() => null);
        if (!message) continue;

        let payload;
        try {
          const info = await queryServerWithFallback(config.host, config.port, config.rcon || null);
          payload = buildServerEmbed(info, config.host, config.port, config.joinUrl || null);
        } catch {
          payload = buildOfflineEmbed(config.host, config.port, config.joinUrl || null);
        }
        await message.edit(payload);
      } catch (err) {
        console.error(`Refresh failed for guild ${guildId}:`, err.message);
      }
    }
  }, 30_000);
}

// ── Interaction handler ──────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  try {
  // ── Open setup modal button ──────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'open_setup_modal') {
    await interaction.showModal(buildSetupModal());
    return;
  }

  // ── /setup command → show modal ──────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === 'setup') {
    const openButton = new ButtonBuilder()
      .setCustomId('open_setup_modal')
      .setLabel('Open Setup Form')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(openButton);

    await interaction.reply({
      content:
        'Before filling Join Link URL:\n' +
        '1) Go to https://app.dub.co and create a short link.\n' +
        '2) Destination must be: steam://run/730//+connect <IP:PORT>\n' +
        '3) Example destination: steam://run/730//+connect 138.199.12.132:26632\n\n' +
        'Click **Open Setup Form** below.',
      flags: MessageFlags.Ephemeral,
      components: [row],
    });
    return;
  }

  // ── Modal submitted ───────────────────────────────────────────────────────
  if (
    interaction.type === InteractionType.ModalSubmit &&
    interaction.customId === 'cs2_setup_modal'
  ) {
    const address = interaction.fields.getTextInputValue('cs2_address').trim();
    const rcon = interaction.fields.getTextInputValue('cs2_rcon').trim();
    const joinUrl = interaction.fields.getTextInputValue('cs2_join_link').trim();

    const addressMatch = address.match(/^(.+):(\d{1,5})$/);
    if (!addressMatch) {
      await interaction.reply({
        content: '❌  Invalid server address. Use format IP:PORT (example: 123.45.67.89:27015).',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const host = addressMatch[1].trim();
    const port = addressMatch[2].trim();

    if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
      await interaction.reply({
        content: '❌  Invalid port number. Must be between 1 and 65535.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!rcon) {
      await interaction.reply({
        content: '❌  RCON password is required.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!/^https:\/\/.+/i.test(joinUrl)) {
      await interaction.reply({
        content: '❌  Join link must be an HTTPS URL. Create one at https://app.dub.co with destination: steam://run/730//+connect <IP:PORT>.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Fetch the channel explicitly — interaction.channel can be null from a modal
    const channel = interaction.channel ?? await client.channels.fetch(interaction.channelId);
    if (!channel) {
      await interaction.editReply({ content: '❌  Could not find the channel. Please try again.' });
      return;
    }

    // Query the server
    let serverInfo;
    let payload;
    try {
      serverInfo = await queryServerWithFallback(host, port, rcon || null);
      payload = buildServerEmbed(serverInfo, host, port, joinUrl);
    } catch (err) {
      console.error(`Initial server query failed for ${host}:${port}:`, err?.message || err);
      payload = buildOfflineEmbed(host, port, joinUrl);
    }

    // Send the public status embed in the same channel
    const statusMessage = await channel.send(payload);

    // Persist config for this guild
    const data = loadData();
    data[interaction.guildId] = {
      host,
      port: Number(port),
      rcon: rcon || null,
      joinUrl,
      channelId: interaction.channelId,
      messageId: statusMessage.id,
    };
    saveData(data);

    await interaction.editReply({
      content:
        '✅  Setup complete! The server status panel has been posted above and will refresh every 30 seconds.',
    });
  }
  } catch (err) {
    console.error('Interaction handler error:', err);
    if (interaction.isRepliable()) {
      const payload = {
        content: '❌  Something went wrong while processing setup. Check bot logs and try again.',
        flags: MessageFlags.Ephemeral,
      };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  }
});

// ── Start ────────────────────────────────────────────────────────────────────
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌  DISCORD_TOKEN is not set. Run the install script first.');
  process.exit(1);
}

client.login(token);
