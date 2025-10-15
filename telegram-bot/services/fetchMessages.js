import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram/tl/index.js';
import { NewMessage } from 'telegram/events/index.js';
import { config, queue } from '../config.js';
import { isAllowedSource } from '../utils/filters.js';
import { isDuplicate, markReposted } from './dedupe.js';
import { repostToTarget } from './repostMessage.js';
import { logInfo, logError } from '../utils/logger.js';

const GROUP_TIMEOUT_MS = 1500; // wait time to aggregate media albums

export async function startWatcher() {
  const client = new TelegramClient(new StringSession(config.session), config.apiId, config.apiHash, {
    connectionRetries: 5,
  });
  await client.connect();

  const peerCache = new Map(); // chatId -> { title, username }
  const albumBuffer = new Map(); // groupedId -> { items: [], timer: NodeJS.Timeout, info }

  async function getPeerMeta(message) {
    const peer = message?.peerId;
    const chatId = peer?.channelId || peer?.chatId || peer?.userId;
    if (!chatId) return null;
    const cached = peerCache.get(String(chatId));
    if (cached) return { chatId, ...cached };
    try {
      const entity = await client.getEntity(peer);
      const title = entity?.title || entity?.firstName || '';
      const username = entity?.username || '';
      const meta = { title, username };
      peerCache.set(String(chatId), meta);
      return { chatId, ...meta };
    } catch (e) {
      return { chatId, title: '', username: '' };
    }
  }

  client.addEventHandler(async (update) => {
    try {
      if (!(update?.className === 'UpdateNewMessage' || update?.className === 'UpdateNewChannelMessage')) return;
      const message = update.message;
      if (!message || !message.message && !message.media) return;
      const meta = await getPeerMeta(message);
      if (!meta?.chatId) return;
      if (!isAllowedSource(meta)) return; // skip outside sources

      const messageId = message.id;
      if (await isDuplicate(meta.chatId, messageId)) return;

      // Aggregate albums using groupedId
      const groupedId = message.groupedId && Number(message.groupedId);
      if (groupedId) {
        let entry = albumBuffer.get(groupedId);
        if (!entry) {
          entry = { items: [], info: { meta, messageId, text: message.message }, timer: null };
          albumBuffer.set(groupedId, entry);
        }
        const mediaItem = await extractMediaItem(client, message);
        if (mediaItem) entry.items.push(mediaItem);
        if (entry.timer) clearTimeout(entry.timer);
        entry.timer = setTimeout(async () => {
          albumBuffer.delete(groupedId);
          if (entry.items.length > 0) {
            await queue.add(async () => {
              await repostToTarget({
                source: { title: meta.title, username: meta.username },
                type: 'album',
                text: entry.info.text,
                album: entry.items,
              });
              await markReposted(meta.chatId, messageId, String(groupedId));
            });
          }
        }, GROUP_TIMEOUT_MS);
        return;
      }

      // Single message types
      const kind = classifyMessage(message);
      if (!kind) return;

      await queue.add(async () => {
        if (kind === 'text') {
          await repostToTarget({
            source: { title: meta.title, username: meta.username },
            type: 'text',
            text: message.message || '',
          });
          await markReposted(meta.chatId, messageId);
          return;
        }

        const media = await extractSingleMedia(client, message);
        if (!media) return;
        await repostToTarget({
          source: { title: meta.title, username: meta.username },
          type: kind,
          text: message.message || '',
          media,
        });
        await markReposted(meta.chatId, messageId);
      });
    } catch (err) {
      logError('Watcher error', err);
    }
  });

  // Also attach GramJS events API for reliability
  client.addEventHandler(async (event) => {
    try {
      const message = event.message;
      if (!message) return;
      const meta = await getPeerMeta(message);
      if (!meta?.chatId) return;
      if (!isAllowedSource(meta)) return;
      const messageId = message.id;
      if (await isDuplicate(meta.chatId, messageId)) return;

      const groupedId = message.groupedId && Number(message.groupedId);
      if (groupedId) {
        let entry = albumBuffer.get(groupedId);
        if (!entry) {
          entry = { items: [], info: { meta, messageId, text: message.message }, timer: null };
          albumBuffer.set(groupedId, entry);
        }
        const mediaItem = await extractMediaItem(client, message);
        if (mediaItem) entry.items.push(mediaItem);
        if (entry.timer) clearTimeout(entry.timer);
        entry.timer = setTimeout(async () => {
          albumBuffer.delete(groupedId);
          if (entry.items.length > 0) {
            await queue.add(async () => {
              await repostToTarget({
                source: { title: meta.title, username: meta.username },
                type: 'album',
                text: entry.info.text,
                album: entry.items,
              });
              await markReposted(meta.chatId, messageId, String(groupedId));
            });
          }
        }, GROUP_TIMEOUT_MS);
        return;
      }

      const kind = classifyMessage(message);
      if (!kind) return;

      await queue.add(async () => {
        if (kind === 'text') {
          await repostToTarget({
            source: { title: meta.title, username: meta.username },
            type: 'text',
            text: message.message || '',
          });
          await markReposted(meta.chatId, messageId);
          return;
        }

        const media = await extractSingleMedia(client, message);
        if (!media) return;
        await repostToTarget({
          source: { title: meta.title, username: meta.username },
          type: kind,
          text: message.message || '',
          media,
        });
        await markReposted(meta.chatId, messageId);
      });
    } catch (err) {
      logError('Event watcher error', err);
    }
  }, new NewMessage({}));

  logInfo('Watcher started. Listening for new messages...');
}

function classifyMessage(message) {
  if (message?.media?.className?.includes('MessageMediaPhoto')) return 'photo';
  if (message?.media?.document) {
    const mimeType = message.media.document.mimeType || '';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType === 'image/gif') return 'animation';
  }
  if ((message?.message || '').trim().length > 0) return 'text';
  return null;
}

async function extractMediaItem(client, message) {
  if (message?.media?.className?.includes('MessageMediaPhoto')) {
    const buffer = await client.downloadMedia(message, {});
    return { type: 'photo', buffer, filename: `photo_${message.id}.jpg` };
  }
  if (message?.media?.document) {
    const mimeType = message.media.document.mimeType || '';
    const buffer = await client.downloadMedia(message, {});
    if (mimeType.startsWith('video/')) {
      return { type: 'video', buffer, filename: `video_${message.id}.mp4` };
    }
    if (mimeType === 'image/gif') {
      return { type: 'animation', buffer, filename: `gif_${message.id}.gif` };
    }
  }
  return null;
}

async function extractSingleMedia(client, message) {
  const item = await extractMediaItem(client, message);
  if (!item) return null;
  return { buffer: item.buffer, filename: item.filename, mime: undefined };
}


