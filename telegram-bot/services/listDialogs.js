import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

async function main() {
  const apiId = Number(process.env.API_ID);
  const apiHash = process.env.API_HASH;
  const session = process.env.TELEGRAM_SESSION;
  if (!apiId || !apiHash || !session) throw new Error('Missing API envs');

  const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 3 });
  await client.connect();

  const dialogs = await client.getDialogs({});
  console.log('Found chats/channels:');
  for (const d of dialogs) {
    const entity = d.entity;
    const id = entity?.id?.toString?.() || entity?.id;
    const title = entity?.title || entity?.firstName || '';
    const username = entity?.username || '';
    const kind = entity?.className || '';
    console.log(`- [${kind}] title="${title}" username="${username}" id=${id}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('List dialogs failed:', e?.message || e);
  process.exit(1);
});


