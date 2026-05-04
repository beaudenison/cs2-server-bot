#!/usr/bin/env node
'use strict';

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const DATA_DIR = '/data';
const ENV_FILE = path.join(DATA_DIR, '.env');

fs.mkdirSync(DATA_DIR, { recursive: true });

const BLUE   = '\x1b[34m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';

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
  console.log(`${YELLOW}  ➜  ${msg}${RESET}`);
}

function success(msg) {
  console.log(`\n${GREEN}${BOLD}✔  ${msg}${RESET}`);
}

let rl;

function openRL() {
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
}

function ask(question) {
  return new Promise((resolve) => {
    rl.question(`\n${BOLD}${question}${RESET} `, (answer) => {
      resolve(answer.trim());
    });
  });
}

function askSecret(question) {
  return new Promise((resolve) => {
    process.stdout.write(`\n${BOLD}${question}${RESET} `);
    let value = '';
    const wasRaw = !!process.stdin.isRaw;
    try { process.stdin.setRawMode(true); } catch { /* not a tty */ }
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    function onData(char) {
      if (char === '\r' || char === '\n') {
        process.stdin.removeListener('data', onData);
        try { process.stdin.setRawMode(wasRaw); } catch { /* ignore */ }
        process.stdin.pause();
        process.stdout.write('\n');
        resolve(value);
      } else if (char === '\u0003') {
        process.exit(1);
      } else if (char === '\u007f' || char === '\b') {
        if (value.length > 0) {
          value = value.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else {
        value += char;
        process.stdout.write('*');
      }
    }

    process.stdin.on('data', onData);
  });
}

async function confirm(question) {
  while (true) {
    const ans = await ask(`${question} [Y/n]`);
    if (ans === '' || ans.toLowerCase() === 'y' || ans.toLowerCase() === 'yes') return;
  }
}

async function main() {
  banner();
  openRL();

  // Step 1
  step(1, 'Create a Discord Application');
  info('Open this URL in your browser:');
  console.log(`\n  ${CYAN}https://discord.com/developers/applications${RESET}\n`);
  info('Click "New Application" and give it a name (e.g. CS2 Play Button).');
  info('On the General Information page you will see your APPLICATION ID.');

  let appId = '';
  while (true) {
    appId = await ask('Paste your Application ID:');
    if (/^\d{17,20}$/.test(appId)) break;
    console.log(`${YELLOW}  ✗  Should be 17-20 digits. Try again.${RESET}`);
  }

  // Step 2
  step(2, 'Create a Bot user and get its token');
  info('In the left sidebar click "Bot".');
  info('Click "Add Bot" → "Yes, do it!"');
  info('Under Token click "Reset Token", confirm, then copy it.');

  let token = '';
  while (true) {
    token = await askSecret('Paste your Bot Token (input hidden):');
    if (token.length > 20) break;
    console.log(`${YELLOW}  ✗  Token looks too short — double-check it.${RESET}`);
  }

  // Step 3
  step(3, 'Enable required Privileged Gateway Intents');
  info('Still on the Bot page, scroll to "Privileged Gateway Intents".');
  info('Toggle ON: SERVER MEMBERS INTENT');
  info('Toggle ON: MESSAGE CONTENT INTENT');
  info('Click "Save Changes".');
  await confirm('Done?');

  // Step 4
  step(4, 'Invite the bot to your Discord server');
  const inviteUrl =
    `https://discord.com/oauth2/authorize?client_id=${appId}` +
    `&permissions=2147485696&scope=bot%20applications.commands`;
  info('Open this invite URL in your browser:');
  console.log(`\n  ${BOLD}${CYAN}${inviteUrl}${RESET}\n`);
  info('Select your server and click Authorise.');
  await confirm('Bot has been invited?');

  // Write credentials
  const envContent = `DISCORD_TOKEN=${token}\nDISCORD_APP_ID=${appId}\n`;
  fs.writeFileSync(ENV_FILE, envContent, { mode: 0o600 });
  process.env.DISCORD_TOKEN  = token;
  process.env.DISCORD_APP_ID = appId;

  rl.close();
  success('.env saved!');

  console.log(`
${BOLD}${BLUE}[ Step 5 ] All done!${RESET}
${YELLOW}  ➜  The bot is starting now.${RESET}
${YELLOW}  ➜  Go to your Discord server and run /setup to post the server panel.${RESET}
${YELLOW}  ➜  Next time just run: docker start cs2-play-button${RESET}

${GREEN}${BOLD}Happy fragging!${RESET}
`);
}

main().catch((err) => {
  console.error('\nSetup wizard error:', err);
  process.exit(1);
});
