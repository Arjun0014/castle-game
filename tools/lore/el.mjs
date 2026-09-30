// ElevenLabs client for the lore narration (build time only: the key is read from the git-ignored repository-root .env
// and never printed, logged or written anywhere; nothing here ships to the client). Default key: ELEVENLABS_API_KEY_2
// (the paid Starter account); pass another env name to use a different account.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = 'https://api.elevenlabs.io';

export function apiKey(name = 'ELEVENLABS_API_KEY_2') {
  if (process.env[name]) return process.env[name].trim();
  const env = path.join(ROOT, '.env');
  if (!fs.existsSync(env)) throw new Error(`${name} not set and no .env at the repository root`);
  const m = new RegExp(`^\\s*${name}\\s*=\\s*(.+?)\\s*$`, 'm').exec(fs.readFileSync(env, 'utf8'));
  if (!m) throw new Error(`${name} missing from .env`);
  return m[1];
}

export async function api(method, url, { key = apiKey(), json, form, raw = false } = {}) {
  const headers = { 'xi-api-key': key };
  let body;
  if (json) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  if (form) body = form;
  const r = await fetch(BASE + url, { method, headers, body });
  if (!r.ok) throw new Error(`${method} ${url} -> ${r.status} ${(await r.text()).slice(0, 400)}`);
  return raw ? Buffer.from(await r.arrayBuffer()) : r.json();
}

export async function credits(key = apiKey()) {
  const s = await api('GET', '/v1/user/subscription', { key });
  return { tier: s.tier, used: s.character_count, limit: s.character_limit, left: s.character_limit - s.character_count };
}

/** TTS with character timestamps: { audio: Buffer (mp3), alignment } */
export async function ttsTimed({ voiceId, text, modelId = 'eleven_v4', stability = 0.5, similarity = 0.75, seed, format = 'mp3_44100_128' }, key = apiKey()) {
  const json = { text, model_id: modelId, voice_settings: { stability, similarity_boost: similarity } };
  if (seed !== undefined) json.seed = seed;
  const res = await api('POST', `/v1/text-to-speech/${voiceId}/with-timestamps?output_format=${format}`, { key, json });
  return { audio: Buffer.from(res.audio_base64, 'base64'), alignment: res.alignment, normalized: res.normalized_alignment };
}

/** Scribe speech-to-text (QA): words with timings */
export async function transcribe(file, key = apiKey()) {
  const form = new FormData();
  form.append('model_id', 'scribe_v2');
  form.append('file', new Blob([fs.readFileSync(file)]), path.basename(file));
  form.append('tag_audio_events', 'true');
  form.append('language_code', 'en');
  return api('POST', '/v1/speech-to-text', { key, form });
}
