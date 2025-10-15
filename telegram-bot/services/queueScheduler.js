import { supabase } from '../config.js';
import { repostToTarget } from './repostMessage.js';
import { logInfo, logError } from '../utils/logger.js';

class QueueScheduler {
  constructor() {
    this.isRunning = false;
    this.timer = null;
    this.postsPerInterval = 3; // Post 3 messages
    this.intervalMs = 60 * 60 * 1000; // Every 1 hour
  }

  /**
   * Add a message to the queue
   */
  async addToQueue(messageData) {
    try {
      const { error } = await supabase
        .from('post_queue')
        .insert({
          message_data: messageData,
          status: 'pending',
          created_at: new Date().toISOString(),
        });

      if (error) throw error;
      logInfo(`Added message to queue. Type: ${messageData.type}`);
    } catch (err) {
      logError('Failed to add message to queue', err);
      throw err;
    }
  }

  /**
   * Get pending messages from the queue
   */
  async getPendingMessages(limit = 3) {
    try {
      const { data, error } = await supabase
        .from('post_queue')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (err) {
      logError('Failed to fetch pending messages', err);
      return [];
    }
  }

  /**
   * Mark a message as posted
   */
  async markAsPosted(id) {
    try {
      const { error } = await supabase
        .from('post_queue')
        .update({
          status: 'posted',
          posted_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      logError(`Failed to mark message ${id} as posted`, err);
    }
  }

  /**
   * Mark a message as failed
   */
  async markAsFailed(id, errorMessage) {
    try {
      const { error } = await supabase
        .from('post_queue')
        .update({
          status: 'failed',
          error_message: errorMessage,
          posted_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      logError(`Failed to mark message ${id} as failed`, err);
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    try {
      // Get count of pending messages
      const { count: pendingCount, error: pendingError } = await supabase
        .from('post_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Get count of posted messages
      const { count: postedCount, error: postedError } = await supabase
        .from('post_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'posted');

      // Get count of failed messages
      const { count: failedCount, error: failedError } = await supabase
        .from('post_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed');

      if (pendingError || postedError || failedError) {
        throw pendingError || postedError || failedError;
      }

      return {
        pending: pendingCount || 0,
        posted: postedCount || 0,
        failed: failedCount || 0,
      };
    } catch (err) {
      logError('Failed to fetch queue stats', err);
      return { pending: 0, posted: 0, failed: 0 };
    }
  }

  /**
   * Process the queue - post up to N messages
   */
  async processQueue() {
    if (!this.isRunning) {
      logInfo('Queue scheduler is paused. Skipping this cycle.');
      return;
    }

    try {
      const messages = await this.getPendingMessages(this.postsPerInterval);
      
      if (messages.length === 0) {
        logInfo('No pending messages in queue.');
        return;
      }

      logInfo(`Processing ${messages.length} messages from queue...`);

      for (const msg of messages) {
        try {
          // Post the message
          await repostToTarget(msg.message_data);
          
          // Mark as posted
          await this.markAsPosted(msg.id);
          logInfo(`Successfully posted message ${msg.id}`);
        } catch (err) {
          logError(`Failed to post message ${msg.id}`, err);
          await this.markAsFailed(msg.id, err.message || 'Unknown error');
        }
      }

      const stats = await this.getQueueStats();
      logInfo(`Queue stats - Pending: ${stats.pending}, Posted: ${stats.posted}, Failed: ${stats.failed}`);
    } catch (err) {
      logError('Queue processing error', err);
    }
  }

  /**
   * Start the scheduler
   */
  start() {
    if (this.timer) {
      logInfo('Queue scheduler is already running.');
      return;
    }

    this.isRunning = true;
    const intervalMinutes = this.intervalMs / 1000 / 60;
    logInfo(`🚀 Queue scheduler started. Posting ${this.postsPerInterval} messages every ${intervalMinutes} minutes.`);

    // Process immediately on start
    logInfo('🔄 Processing queue immediately on startup...');
    this.processQueue();

    // Then process at regular intervals
    this.timer = setInterval(() => {
      logInfo(`⏰ Scheduled interval reached. Processing queue...`);
      this.processQueue();
    }, this.intervalMs);

    logInfo(`⏱️ Next scheduled run in ${intervalMinutes} minutes.`);
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    logInfo('Queue scheduler stopped.');
  }

  /**
   * Pause the scheduler (keeps timer running but skips processing)
   */
  pause() {
    this.isRunning = false;
    logInfo('Queue scheduler paused.');
  }

  /**
   * Resume the scheduler
   */
  resume() {
    const wasPaused = !this.isRunning;
    this.isRunning = true;

    if (!this.timer) {
      const intervalMinutes = this.intervalMs / 1000 / 60;
      logInfo('▶️ Resume requested: no active timer found, creating one now.');
      // Process once immediately after resume
      this.processQueue();
      this.timer = setInterval(() => {
        logInfo('⏰ Scheduled interval reached (after resume). Processing queue...');
        this.processQueue();
      }, this.intervalMs);
      logInfo(`⏱️ Next scheduled run in ${intervalMinutes} minutes.`);
    }

    logInfo(wasPaused ? 'Queue scheduler resumed.' : 'Queue scheduler already running.');
  }
}

// Singleton instance
export const queueScheduler = new QueueScheduler();

