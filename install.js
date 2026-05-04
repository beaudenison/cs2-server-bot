#!/usr/bin/env node
'use strict';

const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');

const DATA_DIR = '/data';
const ENV_FILE = path.join(DATA_DIR, '.env');

// Ensure the data directory exists (named volume)
if (!require('fs').existsSync(DATA_DIR)) {
  require('fs').mkdirSync(DATA_DIR, { recursive: true });
}

const BLUE = '\x1b[34m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function banner() {
  console.log(`
${BOLD}${CYAN}╔═══════════════════════════════════════════════════╗
║        CS2 Server Play Button — Setup Wizard       ║
╚═══════════════════════════════════════════════════╝${RESET}
`);
}

function step(n, title) {
  console.log(`\n${BOLD}${BLUE}[ Step ${n} ] ${title}${RESET}`);
}

function info(msg) {
  console.log(`${YELLOW}  ➜ ${msg}${RESET}`);
}

function success(msg) {
  console.log(`\n${GREEN}${BOLD}✔  ${msg}${RESET}`);
}

async function main() {
  banner();

  // ── Step 1: Create a Discord Application ────────────────────────────────
  step(1, 'Create a Discord Application');
  info('Go to https://discord.com/developers/applications');
  info('Click "New Application" and give it a name (e.g. CS2 Play Button).');
  info('Copy the APPLICATION ID shown on the General Information page.');

  const { appId } = await inquirer.prompt([
    {
      type: 'input',
      name: 'appId',
      message: 'Paste your Application ID:',
      validate: (v) => /^\d{17,20}$/.test(v.trim()) || 'Must be a numeric Discord Snowflake (17-20 digits)',
    },
  ]);

  // ── Step 2: Create a Bot & get the token ────────────────────────────────
  step(2, 'Create a Bot user and get its token');
  info('In the left sidebar click "Bot".');
  info('Click "Add Bot" → "Yes, do it!".');
  info('Under "Token" click "Reset Token", confirm, then copy the token.');
  info('IMPORTANT: Enable "Message Content Intent" if shown.');

  const { token } = await inquirer.prompt([
    {
      type: 'password',
      name: 'token',
      message: 'Paste your Bot Token:',
      mask: '*',
      validate: (v) => v.trim().length > 20 || 'Token looks too short — double-check it.',
    },
  ]);

  // ── Step 3: Set bot permissions ──────────────────────────────────────────
  step(3, 'Configure required Bot Permissions');
  info('Still in the Bot page, scroll to "Privileged Gateway Intents".');
  info('Enable: SERVER MEMBERS INTENT and MESSAGE CONTENT INTENT.');
  info('Save Changes.');

  await inquirer.prompt([
    { type: 'confirm', name: 'ok', message: 'Done with intents?', default: true },
  ]);

  // ── Step 4: Invite the bot ───────────────────────────────────────────────
  step(4, 'Invite the bot to your server');
  const inviteUrl =
    `https://discord.com/oauth2/authorize?client_id=${appId.trim()}` +
    `&permissions=2147485696&scope=bot%20applications.commands`;
  info('Open this URL in your browser to invite the bot:');
  console.log(`\n  ${BOLD}${CYAN}${inviteUrl}${RESET}\n`);
  info('Select your server, click Authorise.');

  await inquirer.prompt([
    { type: 'confirm', name: 'ok', message: 'Bot has been invited to your server?', default: true },
  ]);

  // ── Write .env ───────────────────────────────────────────────────────────
  const envContent = [
    `DISCORD_TOKEN=${token.trim()}`,
    `DISCORD_APP_ID=${appId.trim()}`,
  ].join('\n') + '\n';

  fs.writeFileSync(ENV_FILE, envContent, { mode: 0o600 });

  // Expose to the current process so entrypoint.sh skips the wizard on restart
  process.env.DISCORD_TOKEN = token.trim();
  process.env.DISCORD_APP_ID = appId.trim();

  success('.env file written successfully!');

  // ── Step 5: Start the bot ────────────────────────────────────────────────
  step(5, 'Start the bot');
  info('The bot will start automatically in a moment.');
  info('Next time, run:  docker compose up -d   to start without the wizard.');
  info('');
  info('Once running, go to your Discord server and type /setup');
  info('to configure your CS2 server and post the live status panel.');

  console.log(`\n${GREEN}${BOLD}Setup complete! Happy fragging.${RESET}\n`);
}

main().catch((err) => {
  console.error('\nSetup failed:', err.message);
  process.exit(1);
});
