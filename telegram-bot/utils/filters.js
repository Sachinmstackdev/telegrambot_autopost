import { config } from '../config.js';

export function isAllowedSource(meta) {
  // meta: { title, username }
  const title = (meta.title || '').trim();
  const username = (meta.username || '').trim().replace(/^@/, '');

  const groupMatch = config.sourceGroups.some((g) => g.trim().toLowerCase() === title.toLowerCase());
  const channelMatch = config.sourceChannels.some((c) => {
    const normalized = c.trim().replace(/^@/, '').toLowerCase();
    return normalized && username.toLowerCase() === normalized;
  });
  return groupMatch || channelMatch;
}


