import { supabase } from '../config.js';

export async function isDuplicate(sourceName, messageId) {
  const { data, error } = await supabase
    .from('reposts')
    .select('id')
    .eq('source_name', String(sourceName))
    .eq('message_id', Number(messageId))
    .limit(1)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') {
    // PGRST116 = No rows found for maybeSingle
    console.error('Supabase isDuplicate error:', error);
  }
  return Boolean(data);
}

export async function markReposted(sourceName, messageId, contentHash) {
  const { error } = await supabase
    .from('reposts')
    .upsert(
      {
        source_name: String(sourceName),
        message_id: Number(messageId),
        content_hash: contentHash || '',
      },
      { onConflict: 'source_name,message_id', ignoreDuplicates: false }
    );
  if (error) {
    console.error('Supabase markReposted error:', error);
  }
}


