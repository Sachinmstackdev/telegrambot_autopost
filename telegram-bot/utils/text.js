import { config } from '../config.js';

const MEDIA_CAPTION_LIMIT = 1024;

export function buildFooter(sourceUsername, sourceTitle) {
  if (!config.footerEnabled) return '';
  const override = (config.footerHandleOverride || '').replace(/^@/, '').trim();
  if (override) return `\n\n📢 This post is related to @${override}`;
  if (sourceUsername) return `\n\n📢 This post is related to @${sourceUsername}`;
  const cleanTitle = (sourceTitle || '').trim();
  return cleanTitle ? `\n\n📢 This post is related to ${cleanTitle}` : '';
}

export function appendFooterAndTrim(textOrCaption, footer, limit = MEDIA_CAPTION_LIMIT) {
  const base = textOrCaption || '';
  const combined = `${base}${footer}`;
  if (!limit) return combined;
  if (combined.length <= limit) return combined;
  // Reserve last 3 for ellipsis
  return combined.slice(0, Math.max(0, limit - 3)) + '...';
}

export function trimMessageText(text, maxLen = 4096) {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}


