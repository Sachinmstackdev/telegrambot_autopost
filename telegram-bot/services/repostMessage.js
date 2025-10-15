import { bot, config, helpers } from '../config.js';
import { appendFooterAndTrim, buildFooter, trimMessageText } from '../utils/text.js';
import { logInfo, logError } from '../utils/logger.js';
import { maybeTransformCaption } from './ai.js';

// mediaGroup: optional aggregated array for albums
export async function repostToTarget({
  source, // { title, username }
  type,   // 'text' | 'photo' | 'video' | 'animation' | 'album'
  text,   // string
  media,  // for single: { buffer?, fileId?, mime?, filename?, width?, height?, duration? }
  album,  // for album: [{ type: 'photo'|'video', buffer?, fileId?, mime?, filename?, caption? }]
}) {
  const footer = buildFooter(source?.username, source?.title);
  const chatId = config.targetChannel;

  try {
    if (type === 'text') {
      // Keep original text exactly as is, no trimming or transformation
      const res = await bot.telegram.sendMessage(chatId, text || '', { disable_web_page_preview: false });
      if (config.logSuccess) {
        logInfo(`✅ Reposted from @${source?.username || source?.title || 'unknown'} → ${config.targetChannel}`);
      }
      return res;
    }

    if (type === 'photo') {
      // Keep original caption exactly as is
      const caption = text || '';
      const input = media?.fileId ? media.fileId : { source: media.buffer, filename: media.filename };
      const res = await bot.telegram.sendPhoto(chatId, input, { caption });
      if (config.logSuccess) {
        logInfo(`✅ Reposted from @${source?.username || source?.title || 'unknown'} → ${config.targetChannel}`);
      }
      return res;
    }

    if (type === 'video') {
      // Keep original caption exactly as is
      const caption = text || '';
      const input = media?.fileId ? media.fileId : { source: media.buffer, filename: media.filename };
      const res = await bot.telegram.sendVideo(chatId, input, { caption, supports_streaming: true });
      if (config.logSuccess) {
        logInfo(`✅ Reposted from @${source?.username || source?.title || 'unknown'} → ${config.targetChannel}`);
      }
      return res;
    }

    if (type === 'animation') {
      // Keep original caption exactly as is
      const caption = text || '';
      const input = media?.fileId ? media.fileId : { source: media.buffer, filename: media.filename };
      const res = await bot.telegram.sendAnimation(chatId, input, { caption });
      if (config.logSuccess) {
        logInfo(`✅ Reposted from @${source?.username || source?.title || 'unknown'} → ${config.targetChannel}`);
      }
      return res;
    }

    if (type === 'album' && Array.isArray(album) && album.length > 0) {
      const mediaGroup = album.map((item, idx) => {
        // Keep original captions exactly as is
        const caption = item.caption || undefined;
        if (item.type === 'photo') {
          const input = item.fileId ? item.fileId : { source: item.buffer, filename: item.filename };
          return { type: 'photo', media: input, caption };
        }
        if (item.type === 'video') {
          const input = item.fileId ? item.fileId : { source: item.buffer, filename: item.filename };
          return { type: 'video', media: input, caption, supports_streaming: true };
        }
        // default to photo
        const input = item.fileId ? item.fileId : { source: item.buffer, filename: item.filename };
        return { type: 'photo', media: input, caption };
      });

      const res = await bot.telegram.sendMediaGroup(chatId, mediaGroup);
      if (config.logSuccess) {
        logInfo(`✅ Reposted from @${source?.username || source?.title || 'unknown'} → ${config.targetChannel}`);
      }
      return res;
    }

    throw new Error(`Unsupported type: ${type}`);
  } catch (err) {
    logError(`❌ Error reposting from @${source?.username || source?.title || 'unknown'}:`, err);
    throw err;
  }
}


