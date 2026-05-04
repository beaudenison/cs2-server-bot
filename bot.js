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
} = require('discord.js');

const GameDig = require('gamedig');
const fs = require('fs');
const path = require('path');

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
  const result = await GameDig.query({
    type: 'cs2',
    host,
    port: Number(port),
    requestRules: false,
  });
  return {
    name: result.name,
    map: result.map,
    players: result.players.length,
    maxPlayers: result.maxplayers,
    raw: result,
  };
}

// ── Build the live server status embed ──────────────────────────────────────
function buildServerEmbed(info, host, port) {
  const connectUrl = `steam://connect/${host}:${port}`;

  const embed = new EmbedBuilder()
    .setTitle('🖥️  CS2 Server Status')
    .setColor(0x00b300)
    .addFields(
      { name: '🏷️  Server Name', value: info.name, inline: false },
      { name: '🗺️  Map', value: info.map, inline: true },
      {
        name: '👥  Players',
        value: `${info.players} / ${info.maxPlayers}`,
        inline: true,
      },
    )
    .setFooter({ text: `${host}:${port}  •  Updates every 30 seconds` })
    .setTimestamp();

  const joinButton = new ButtonBuilder()
    .setLabel('🟢  Join Server')
    .setStyle(ButtonStyle.Link)
    .setURL(connectUrl);

  const row = new ActionRowBuilder().addComponents(joinButton);

  return { embeds: [embed], components: [row] };
}

// ── Build an offline embed ───────────────────────────────────────────────────
function buildOfflineEmbed(host, port) {
  const embed = new EmbedBuilder()
    .setTitle('🖥️  CS2 Server Status')
    .setColor(0xff0000)
    .setDescription('❌  Server is offline or unreachable.')
    .setFooter({ text: `${host}:${port}  •  Updates every 30 seconds` })
    .setTimestamp();

  const joinButton = new ButtonBuilder()
    .setLabel('🔴  Server Offline')
    .setStyle(ButtonStyle.Link)
    .setURL(`steam://connect/${host}:${port}`)
    .setDisabled(true);

  const row = new ActionRowBuilder().addComponents(joinButton);

  return { embeds: [embed], components: [row] };
}

// ── Slash command definition ─────────────────────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure your CS2 server and post a live status panel')
    .toJSON(),
];

// ── Bot client ───────────────────────────────────────────────────────────────
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
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
          const info = await queryServer(config.host, config.port);
          payload = buildServerEmbed(info, config.host, config.port);
        } catch {
          payload = buildOfflineEmbed(config.host, config.port);
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
  // ── /setup command → show modal ──────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === 'setup') {
    const modal = new ModalBuilder()
      .setCustomId('cs2_setup_modal')
      .setTitle('CS2 Server Setup');

    const ipInput = new TextInputBuilder()
      .setCustomId('cs2_host')
      .setLabel('Server IP Address')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g.  123.45.67.89')
      .setRequired(true);

    const portInput = new TextInputBuilder()
      .setCustomId('cs2_port')
      .setLabel('Server Port')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Default CS2 port is 27015')
      .setValue('27015')
      .setRequired(true);

    const rconInput = new TextInputBuilder()
      .setCustomId('cs2_rcon')
      .setLabel('RCON Password (stored locally, never shared)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Leave blank if not using RCON')
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(ipInput),
      new ActionRowBuilder().addComponents(portInput),
      new ActionRowBuilder().addComponents(rconInput),
    );

    await interaction.showModal(modal);
    return;
  }

  // ── Modal submitted ───────────────────────────────────────────────────────
  if (
    interaction.type === InteractionType.ModalSubmit &&
    interaction.customId === 'cs2_setup_modal'
  ) {
    const host = interaction.fields.getTextInputValue('cs2_host').trim();
    const port = interaction.fields.getTextInputValue('cs2_port').trim();
    const rcon = interaction.fields.getTextInputValue('cs2_rcon').trim();

    if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
      await interaction.reply({
        content: '❌  Invalid port number. Must be between 1 and 65535.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    // Query the server
    let serverInfo;
    let payload;
    try {
      serverInfo = await queryServer(host, port);
      payload = buildServerEmbed(serverInfo, host, port);
    } catch {
      payload = buildOfflineEmbed(host, port);
    }

    // Send the public status embed in the same channel
    const statusMessage = await interaction.channel.send(payload);

    // Persist config for this guild
    const data = loadData();
    data[interaction.guildId] = {
      host,
      port: Number(port),
      rcon: rcon || null,
      channelId: interaction.channelId,
      messageId: statusMessage.id,
    };
    saveData(data);

    await interaction.editReply({
      content:
        '✅  Setup complete! The server status panel has been posted above and will refresh every 30 seconds.',
    });
  }
});

// ── Start ────────────────────────────────────────────────────────────────────
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌  DISCORD_TOKEN is not set. Run `npm run install-bot` first.');
  process.exit(1);
}

client.login(token);
