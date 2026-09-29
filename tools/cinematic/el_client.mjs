// Minimal ElevenLabs client for the cinematic build tools (build-time only; the key never leaves this process).
// Key: ELEVENLABS_API_KEY from the environment or the repository-root .env (git-ignored). Never printed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function apiKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
  const env = path.join(ROOT, '.env');
  if (!fs.existsSync(env)) throw new Error('ELEVENLABS_API_KEY not set and no .env at the repository root');
  const m = /^\s*ELEVENLABS_API_KEY\s*=\s*(.+?)\s*$/m.exec(fs.readFileSync(env, 'utf8'));
  if (!m) throw new Error('ELEVENLABS_API_KEY missing from .env');
  return m[1].replace(/^['"]|['"]$/g, '');
}

const BASE = 'https://api.elevenlabs.io';

export async function creditsUsed(key = apiKey()) {
  const r = await fetch(BASE + '/v1/user/subscription', { headers: { 'xi-api-key': key } });
  if (!r.ok) throw new Error('subscription HTTP ' + r.status);
  const j = await r.json();
  return { used: j.character_count, limit: j.character_limit };
}

/** Text to speech with character alignment. Returns { audio: Buffer, alignment, normalized_alignment }. */
export async function ttsWithTimestamps({ voiceId, text, modelId = 'eleven_v3', stability = 0.5, similarity = 0.75, style, speed, seed, format = 'mp3_44100_128' }, key = apiKey()) {
  const voice_settings = { stability, similarity_boost: similarity };
  if (style !== undefined) voice_settings.style = style;
  if (speed !== undefined) voice_settings.speed = speed;
  const body = { text, model_id: modelId, voice_settings };
  if (seed !== undefined) body.seed = seed;
  const r = await fetch(`${BASE}/v1/text-to-speech/${voiceId}/with-timestamps?output_format=${format}`, {
    method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`tts HTTP ${r.status}: ${(await r.text()).slice(0, 400)}`);
  const j = await r.json();
  return { audio: Buffer.from(j.audio_base64, 'base64'), alignment: j.alignment, normalized_alignment: j.normalized_alignment };
}

/** Speech to text (Scribe) with word timestamps, for QA of generated narration. */
export async function transcribe(file, key = apiKey(), modelId = 'scribe_v2') {
  const fd = new FormData();
  fd.append('model_id', modelId);
  fd.append('timestamps_granularity', 'word');
  fd.append('tag_audio_events', 'true');
  fd.append('file', new Blob([fs.readFileSync(file)]), path.basename(file));
  const r = await fetch(BASE + '/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': key }, body: fd });
  if (!r.ok) throw new Error(`stt HTTP ${r.status}: ${(await r.text()).slice(0, 400)}`);
  return r.json();
}

/** Sound effect generation. */
export async function soundEffect({ text, duration, influence = 0.5, loop = false, format = 'mp3_44100_128' }, key = apiKey()) {
  const body = { text, prompt_influence: influence, model_id: 'eleven_text_to_sound_v2' };
  if (duration) body.duration_seconds = duration;
  if (loop) body.loop = true;
  const r = await fetch(`${BASE}/v1/sound-generation?output_format=${format}`, {
    method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`sfx HTTP ${r.status}: ${(await r.text()).slice(0, 400)}`);
  return Buffer.from(await r.arrayBuffer());
}

/** Music (Eleven Music) from a composition plan or a prompt. */
export async function composeMusic({ plan, prompt, lengthMs, modelId = 'music_v2_5', seed, instrumental = true, format = 'mp3_44100_128' }, key = apiKey()) {
  const body = { model_id: modelId };
  if (plan) body.composition_plan = plan;
  if (prompt) { body.prompt = prompt; body.force_instrumental = instrumental; if (lengthMs) body.music_length_ms = lengthMs; }
  if (seed !== undefined) body.seed = seed;
  const r = await fetch(`${BASE}/v1/music?output_format=${format}`, {
    method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`music HTTP ${r.status}: ${(await r.text()).slice(0, 600)}`);
  return Buffer.from(await r.arrayBuffer());
}
