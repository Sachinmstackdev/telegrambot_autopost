import { config } from '../config.js';
import OpenAI from 'openai';

let client = null;
function getClient() {
  if (!client) client = new OpenAI({ apiKey: config.ai.apiKey });
  return client;
}

export async function maybeTransformCaption(original) {
  // Always return original text unchanged - no AI transformations
  return original || '';
}


