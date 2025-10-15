import dotenv from 'dotenv';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';

dotenv.config();

function getRl() {
  return readline.createInterface({ input, output });
}

async function prompt(question) {
  const rl = getRl();
  try {
    const answer = await rl.question(question);
    rl.close();
    return answer.trim();
  } catch (e) {
    rl.close();
    throw e;
  }
}

async function main() {
  const apiId = Number(process.env.API_ID) || Number(await prompt('Enter API_ID: '));
  const apiHash = process.env.API_HASH || (await prompt('Enter API_HASH: '));
  const phoneNumber = await prompt('Enter your phone number (with country code): ');

  const stringSession = new StringSession('');
  const client = new TelegramClient(stringSession, apiId, apiHash, { connectionRetries: 5 });

  await client.start({
    phoneNumber: async () => phoneNumber,
    password: async () => await prompt('2FA password (if any, else press enter): '),
    phoneCode: async () => await prompt('Enter the code you received: '),
    onError: (err) => console.error('Auth error:', err?.message || err),
  });

  const session = client.session.save();
  console.log('\nCopy the session string below into your .env as TELEGRAM_SESSION:\n');
  console.log(session);
  console.log('\nDone.');
  process.exit(0);
}

main().catch((e) => {
  console.error('Failed to generate session:', e?.message || e);
  process.exit(1);
});


