import { bot, config } from './config.js';
import { startWatcher } from './services/fetchMessages.js';
import { logInfo, logError } from './utils/logger.js';
import { repostToTarget } from './services/repostMessage.js';
import { markReposted } from './services/dedupe.js';
import { contentHashFromTelegrafMessage } from './utils/hash.js';
import { queueScheduler } from './services/queueScheduler.js';

async function bootstrap() {
  try {
    // Launch Bot API client (used only for posting)
    // Basic commands
    bot.start(async (ctx) => {
      await ctx.reply('Bot is active. Send or forward messages in bulk (50-100), and I will post 3 messages every 30 minutes to your channel.\n\nCommands:\n/queue - Check queue status\n/pause - Pause posting\n/resume - Resume posting');
    });

    // Queue status command
    bot.command('queue', async (ctx) => {
      try {
        const stats = await queueScheduler.getQueueStats();
        const status = queueScheduler.isRunning ? '✅ Running' : '⏸️ Paused';
        await ctx.reply(
          `📊 Queue Status: ${status}\n\n` +
          `⏳ Pending: ${stats.pending}\n` +
          `✅ Posted: ${stats.posted}\n` +
          `❌ Failed: ${stats.failed}\n\n` +
          `⚙️ Settings: ${queueScheduler.postsPerInterval} posts every ${queueScheduler.intervalMs / 1000 / 60} minutes`
        );
      } catch (err) {
        logError('Queue status command error', err);
        await ctx.reply('Failed to fetch queue status.');
      }
    });

    // Pause command
    bot.command('pause', async (ctx) => {
      queueScheduler.pause();
      await ctx.reply('⏸️ Queue paused. Messages will not be posted until you /resume.');
    });

    // Resume command
    bot.command('resume', async (ctx) => {
      queueScheduler.resume();
      await ctx.reply('▶️ Queue resumed. Posting will continue.');
    });

    // Test command - manually trigger queue processing
    bot.command('test', async (ctx) => {
      try {
        await ctx.reply('🔄 Manually processing queue...');
        await queueScheduler.processQueue();
        const stats = await queueScheduler.getQueueStats();
        await ctx.reply(
          `✅ Queue processed!\n\n` +
          `⏳ Pending: ${stats.pending}\n` +
          `✅ Posted: ${stats.posted}\n` +
          `❌ Failed: ${stats.failed}`
        );
      } catch (err) {
        logError('Test command error', err);
        await ctx.reply('❌ Error processing queue. Check logs.');
      }
    });

    // Status command - show scheduler status
    bot.command('status', async (ctx) => {
      try {
        const stats = await queueScheduler.getQueueStats();
        const isRunning = queueScheduler.isRunning;
        const intervalMinutes = queueScheduler.intervalMs / 1000 / 60;
        
        await ctx.reply(
          `🤖 Scheduler Status\n\n` +
          `📊 Queue Status: ${isRunning ? '✅ Running' : '⏸️ Paused'}\n` +
          `⏳ Pending: ${stats.pending}\n` +
          `✅ Posted: ${stats.posted}\n` +
          `❌ Failed: ${stats.failed}\n\n` +
          `⚙️ Settings: ${queueScheduler.postsPerInterval} posts every ${intervalMinutes} minutes\n\n` +
          `💡 Tip: Watch your terminal for automatic posting logs!`
        );
      } catch (err) {
        logError('Status command error', err);
        await ctx.reply('❌ Error fetching status.');
      }
    });

    // Ingest: any messages you send/forward to the bot in DM will be reposted to your channel
    const albumIngestBuffer = new Map(); // media_group_id -> { items, timer, baseText, source }
    bot.on('message', async (ctx) => {
      try {
        const msg = ctx.message;
        const chatType = ctx.chat?.type;
        // Only handle DM to the bot to avoid group noise
        if (chatType !== 'private') return;
        logInfo(`DM ingest received: type=${chatType} hasPhoto=${Array.isArray(msg.photo)&&msg.photo.length>0} hasVideo=${!!msg.video} hasAnim=${!!msg.animation} isAlbum=${!!msg.media_group_id}`);

        
        const hasPhoto = Array.isArray(msg.photo) && msg.photo.length > 0;
        const hasVideo = !!msg.video;
        const hasAnim = !!msg.animation;
        const isAlbum = !!msg.media_group_id;
        const source = {
          title: msg.forward_from_chat?.title || msg.forward_from?.first_name || config.sourceGroups?.[0] || 'unknown',
          username: msg.forward_from_chat?.username || msg.forward_from?.username || '',
        };

        const hash = contentHashFromTelegrafMessage(msg);
        await markReposted('ingest', msg.message_id, hash);

        if (isAlbum) {
          const groupId = String(msg.media_group_id);
          let entry = albumIngestBuffer.get(groupId);
          if (!entry) {
            entry = { items: [], timer: null, baseText: msg.caption || msg.text || '', source };
            albumIngestBuffer.set(groupId, entry);
          }
          // push item
          if (hasPhoto) {
            const file = msg.photo[msg.photo.length - 1];
            entry.items.push({ type: 'photo', fileId: file.file_id, caption: msg.caption || undefined });
          } else if (hasVideo) {
            entry.items.push({ type: 'video', fileId: msg.video.file_id, caption: msg.caption || undefined });
          } else if (hasAnim) {
            entry.items.push({ type: 'animation', fileId: msg.animation.file_id, caption: msg.caption || undefined });
          }
          if (entry.timer) clearTimeout(entry.timer);
          entry.timer = setTimeout(async () => {
            albumIngestBuffer.delete(groupId);
            if (entry.items.length === 0) return;
            // Add to queue instead of posting immediately
            await queueScheduler.addToQueue({
              source: entry.source,
              type: 'album',
              text: entry.baseText,
              album: entry.items,
            });
          }, 1200);
          return;
        }

        // Add all messages to queue instead of posting immediately
        if (hasPhoto) {
          const file = msg.photo[msg.photo.length - 1];
          await queueScheduler.addToQueue({ source, type: 'photo', text: msg.caption || '', media: { fileId: file.file_id } });
          return;
        }
        if (hasVideo) {
          await queueScheduler.addToQueue({ source, type: 'video', text: msg.caption || '', media: { fileId: msg.video.file_id } });
          return;
        }
        if (hasAnim) {
          await queueScheduler.addToQueue({ source, type: 'animation', text: msg.caption || '', media: { fileId: msg.animation.file_id } });
          return;
        }
        if (msg.text) {
          await queueScheduler.addToQueue({ source, type: 'text', text: msg.text });
          return;
        }
      } catch (e) {
        logError('Forward-ingest error', e);
      }
    });

    await bot.launch();
    logInfo('Bot launched.');

    // Start the queue scheduler
    queueScheduler.start();

    // Start MTProto watcher (reads all allowed sources)
    await startWatcher();

    // Graceful stop
    process.once('SIGINT', () => {
      queueScheduler.stop();
      bot.stop('SIGINT');
    });
    process.once('SIGTERM', () => {
      queueScheduler.stop();
      bot.stop('SIGTERM');
    });
  } catch (err) {
    logError('Failed to start application', err);
    process.exit(1);
  }
}

bootstrap();


