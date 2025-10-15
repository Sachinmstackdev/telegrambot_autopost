import crypto from 'node:crypto';

export function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function numericFromHash(hashHex) {
  // Use first 12 hex chars -> up to 48 bits < Number.MAX_SAFE_INTEGER
  const slice = (hashHex || '').slice(0, 12) || '0';
  return Number.parseInt(slice, 16);
}

export function contentHashFromTelegrafMessage(msg) {
  // Prefer file_unique_id(s) for strong identity; fallback to text/caption
  let parts = [];
  if (msg?.media_group_id) parts.push(`group:${msg.media_group_id}`);
  if (msg?.photo?.length) {
    // Bot API gives array of sizes; use the biggest's file_unique_id
    const best = [...msg.photo].sort((a, b) => (b.file_size || 0) - (a.file_size || 0))[0];
    if (best?.file_unique_id) parts.push(`p:${best.file_unique_id}`);
  }
  if (msg?.video?.file_unique_id) parts.push(`v:${msg.video.file_unique_id}`);
  if (msg?.animation?.file_unique_id) parts.push(`g:${msg.animation.file_unique_id}`);
  if (msg?.document?.file_unique_id) parts.push(`d:${msg.document.file_unique_id}`);
  if (msg?.text) parts.push(`t:${msg.text}`);
  if (msg?.caption) parts.push(`c:${msg.caption}`);
  if (parts.length === 0) parts.push(`id:${msg?.message_id || '0'}`);
  return sha256Hex(parts.join('|'));
}


