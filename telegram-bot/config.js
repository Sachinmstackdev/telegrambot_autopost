import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Telegraf, Input } from 'telegraf';
import PQueue from 'p-queue';
import { createClient } from '@supabase/supabase-js';

// Load .env from local folder, then fallback to parent project root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
// Allow parent .env to override local values so runtime tweaks take effect
dotenv.config({ path: path.join(__dirname, '..', '.env'), override: true });

function parseJsonArray(value, fallback = []) {
  try {
    if (!value) return fallback;
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function parseIntervalToMs(value, defaultMs = 0) {
  if (!value) return defaultMs;
  const match = String(value).trim().match(/^(\d+)(ms|s|m|h)$/i);
  if (!match) return defaultMs;
  const n = Number(match[1]);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 'ms': return n;
    case 's': return n * 1000;
    case 'm': return n * 60 * 1000;
    case 'h': return n * 60 * 60 * 1000;
    default: return defaultMs;
  }
}

export const config = {
  botToken: process.env.BOT_TOKEN,
  apiId: Number(process.env.API_ID),
  apiHash: process.env.API_HASH,
  session: process.env.TELEGRAM_SESSION,
  sourceGroups: parseJsonArray(process.env.SOURCE_GROUPS, []),
  sourceChannels: parseJsonArray(process.env.SOURCE_CHANNELS, []),
  targetChannel: process.env.TARGET_CHANNEL,
  postIntervalMs: parseIntervalToMs(process.env.POST_INTERVAL, 0),
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
  ai: {
    enabled: String(process.env.AI_ENABLED || '').toLowerCase() === '1' || String(process.env.AI_ENABLED || '').toLowerCase() === 'true',
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    systemPrompt: process.env.AI_SYSTEM_PROMPT || 'Rewrite the caption to be catchy, short, and safe for Telegram. Keep any hashtags. Do not add links.'
  },
  footerEnabled: !(String(process.env.FOOTER_ENABLED || '').toLowerCase() === '0' || String(process.env.FOOTER_ENABLED || '').toLowerCase() === 'false'),
  footerHandleOverride: (process.env.FOOTER_HANDLE || '').trim(),
  logSuccess: !(String(process.env.LOG_SUCCESS || '').toLowerCase() === '0' || String(process.env.LOG_SUCCESS || '').toLowerCase() === 'false'),
};

if (!config.botToken) throw new Error('BOT_TOKEN is required');
if (!config.apiId || !config.apiHash) throw new Error('API_ID and API_HASH are required');
if (!config.session) throw new Error('TELEGRAM_SESSION is required');
if (!config.targetChannel) throw new Error('TARGET_CHANNEL is required');
if (!config.supabaseUrl || !config.supabaseKey) throw new Error('Supabase URL and Key are required');

export const bot = new Telegraf(config.botToken);
export const queue = new PQueue({ intervalCap: 1, interval: Math.max(config.postIntervalMs, 0) });

export const supabase = createClient(config.supabaseUrl, config.supabaseKey);

export const helpers = { Input, parseIntervalToMs };


