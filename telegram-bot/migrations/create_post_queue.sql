-- ============================================
-- Complete Database Setup for Telegram Bot
-- ============================================

-- 1. Create reposts table for deduplication
-- This tracks which messages have already been posted to avoid duplicates
CREATE TABLE IF NOT EXISTS reposts (
  id BIGSERIAL PRIMARY KEY,
  source_name TEXT NOT NULL,
  message_id BIGINT NOT NULL,
  content_hash TEXT NOT NULL,
  posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_repost UNIQUE (source_name, message_id)
);

-- Create index on content_hash for faster duplicate checking
CREATE INDEX IF NOT EXISTS idx_reposts_content_hash ON reposts(content_hash);

-- Create index on source_name for faster queries
CREATE INDEX IF NOT EXISTS idx_reposts_source_name ON reposts(source_name);

-- Add comments to reposts table
COMMENT ON TABLE reposts IS 'Tracks posted messages to prevent duplicates';
COMMENT ON COLUMN reposts.source_name IS 'Source channel or group name';
COMMENT ON COLUMN reposts.message_id IS 'Original message ID from source';
COMMENT ON COLUMN reposts.content_hash IS 'Hash of message content for duplicate detection';

-- 2. Create post_queue table for scheduled posting
-- This stores messages that will be posted at scheduled intervals
CREATE TABLE IF NOT EXISTS post_queue (
  id BIGSERIAL PRIMARY KEY,
  message_data JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  posted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT status_check CHECK (status IN ('pending', 'posted', 'failed'))
);

-- Create index on status for faster queries
CREATE INDEX IF NOT EXISTS idx_post_queue_status ON post_queue(status);

-- Create index on created_at for ordering
CREATE INDEX IF NOT EXISTS idx_post_queue_created_at ON post_queue(created_at);

-- Create composite index for pending messages ordered by creation time
CREATE INDEX IF NOT EXISTS idx_post_queue_pending_created ON post_queue(status, created_at) WHERE status = 'pending';

-- Add comments to post_queue table
COMMENT ON TABLE post_queue IS 'Queue for scheduled posting of messages to Telegram channel';
COMMENT ON COLUMN post_queue.message_data IS 'JSONB containing message data (source, type, text, media, album)';
COMMENT ON COLUMN post_queue.status IS 'Status of the message: pending, posted, or failed';
COMMENT ON COLUMN post_queue.error_message IS 'Error message if posting failed';
COMMENT ON COLUMN post_queue.created_at IS 'Timestamp when message was added to queue';
COMMENT ON COLUMN post_queue.posted_at IS 'Timestamp when message was posted or failed';

-- ============================================
-- Setup complete!
-- ============================================

