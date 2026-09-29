// Minimal ElevenLabs client for the heroine's voice (build time only; the key never leaves this process and is
// never printed). Key: ELEVENLABS_API_KEY from the environment or the repository-root .env (git-ignored).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = 'https://api.elevenlabs.io';

export function apiKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
  const env = path.join(ROOT, '.env');
  if (!fs.existsSync(env)) throw new Error('ELEVENLABS_API_KEY not set and no .env at the repository root');
  const m = /^\s*ELEVENLABS_API_KEY\s*=\s*(.+?)\s*$/m.exec(fs.readFileSync(env, 'utf8'));
  if (!m) throw new Error('ELEVENLABS_API_KEY missing from .env');
  return m[1].replace(/^['"]|['"]$/g, '');
}

export async function credits(key = apiKey()) {
  const r = await fetch(BASE + '/v1/user/subscription', { headers: { 'xi-api-key': key } });
  if (!r.ok) throw new Error('subscription HTTP ' + r.status);
  const j = await r.json();
  return { used: j.character_count, limit: j.character_limit };
}

/** Eleven v3 text to speech with character timestamps → { audio: Buffer, alignment }. */
export async function tts({ voiceId, text, modelId = 'eleven_v3', stability = 0.5, similarity = 0.75, seed, format = 'mp3_44100_128' }, key = apiKey()) {
  const body = { text, model_id: modelId, voice_settings: { stability, similarity_boost: similarity } };
  if (seed !== undefined) body.seed = seed;
  const r = await fetch(`${BASE}/v1/text-to-speech/${voiceId}/with-timestamps?output_format=${format}`, {
    method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`tts HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  return { audio: Buffer.from(j.audio_base64, 'base64'), alignment: j.alignment };
}

/** Scribe speech-to-text with word timestamps (QA: missing words, audio tags read aloud). */
export async function transcribe(file, key = apiKey()) {
  const fd = new FormData();
  fd.append('model_id', 'scribe_v1');
  fd.append('timestamps_granularity', 'word');
  fd.append('tag_audio_events', 'true');
  fd.append('file', new Blob([fs.readFileSync(file)]), path.basename(file));
  const r = await fetch(BASE + '/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': key }, body: fd });
  if (!r.ok) throw new Error(`stt HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}
