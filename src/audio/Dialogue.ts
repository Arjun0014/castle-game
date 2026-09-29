import * as THREE from 'three';
import type { Game } from '../game/Game';
import dialogueData from '../data/dialogue.json';
import voiceManifest from '../data/voiceManifest.json';
import { OBJECTIVES } from '../data/objectives';
import { b2t } from '../levels/Level';

/**
 * The heroine's voice (session 7). Plan and rules: docs/DIALOGUE.md; lines: data/dialogue.json.
 *
 * - One line at a time with priorities (5 story/boss/discovery · 4 tutorial/hint · 3 combat · 2 flavour ·
 *   1 idle): higher lines interrupt only flavour/idle; combat+ lines queue briefly; everything else waits its
 *   turn or is dropped. Pools rotate lines with cooldowns and chances so repeated systems never sound robotic.
 * - Subtitles always show while she speaks. Ambience and effects duck under her voice.
 * - Residency: shared barks load once (scope vo-core), the floor's opening / checkpoint / shift / flavour lines
 *   load behind the floor's loading screen (scope floorN), everything else is prefetched when the hero comes
 *   within PREFETCH m of where it will be triggered (scope voN) and released with the floor.
 */

interface Line { id: string; floor: number; cat: string; pri: number; pool?: string; trigger: string; text: string; tts: string }
interface PoolCfg { cooldown: number; chance: number }

const DATA = dialogueData as unknown as { lines: Line[]; pools: Record<string, PoolCfg> };
const VOICE = (voiceManifest as { lines: Record<string, { dur: number }> }).lines;
/** categories that are said once per run */
const ONCE = new Set(['onboarding', 'story', 'boss', 'discovery', 'hint', 'flavour']);
/** loaded with the floor (likely within the first minute or at any moment) */
const BOOT = new Set(['onboarding', 'story', 'checkpoint', 'shift', 'flavour']);
const PREFETCH = 40;
const BOSS_ENCOUNTER: Record<string, string> = { gate_warden: 'E13', kingsguard: 'E10', last_crown: 'BOSS' };
const HEAVY = new Set(['royal_warden', 'hollow_warden']);
const ARCHERS = new Set(['archer', 'echo_archer']);

export class Dialogue {
  /** false in automation (no loads, no lines) unless `?voice` */
  enabled: boolean;
  private lines = new Map<string, Line>();
  private floorId = 0;
  private played = new Set<string>();
  private cur: { line: Line; src: AudioBufferSourceNode | null; until: number } | null = null;
  private queue: { line: Line; at: number }[] = [];
  private pending: { line: Line; until: number } | null = null;
  /** real seconds (hit-stop and slow motion do not stretch her pauses) */
  private clock = 0;
  private lastEnd = -99;
  private lastCombatAt = -99;
  private lastShiftAt = -99;
  private archerAt = -999;
  private manyAt = -999;
  private heavyFloors = new Set<number>();
  private poolAt = new Map<string, number>();
  private poolSeen = new Map<string, Set<string>>();
  private poolLast = new Map<string, string>();
  private anchors: { id: string; pos: THREE.Vector3 }[] = [];
  private idleLines: string[] = [];
  private prefetchT = 0;
  private floorT = 0;
  private idleT = 0;
  private idlePos = new THREE.Vector3();
  private idleLook = 0;
  private idleHits = 0;
  private firstKill = false;
  /** what she said, for tests (id, clock) */
  log: { id: string; t: number; audio: boolean }[] = [];

  constructor(private g: Game, automated: boolean) {
    this.enabled = !automated || new URLSearchParams(location.search).has('voice');
    for (const l of DATA.lines) this.lines.set(l.id, l);
    const s = g.signals;
    s.on('objective', (d) => { const l = this.byTrigger('objective:' + d.id)[0]; if (l) this.say(l); });
    s.on('hint', (d) => this.sayId(d.line));
    s.on('trace', (d) => { if (d.first) for (const l of this.byTrigger('trace:' + d.tid)) this.say(l); });
    s.on('prompt', (d) => { for (const l of this.byTrigger('prompt:' + d.pid)) this.say(l); });
    s.on('sigil:near', (d) => { for (const l of this.byTrigger('sigilnear:' + d.cid)) this.say(l); });
    s.on('sigil:activate', (d) => {
      if (d.rite) { this.sayId('f1_rite'); return; }
      if (d.first) { const l = this.fromPool('cp'); if (l) this.say(l); }
    });
    s.on('kill', (d) => {
      if (!this.firstKill && this.floorId === 1) { this.firstKill = true; this.sayId('f1_first_kill'); }
      else if (d.execution) { const l = this.fromPool('execute'); if (l) this.say(l); }
    });
    s.on('encounter:start', (d) => this.onFight(d as { id: string }));
    s.on('encounter:clear', (d) => {
      if (d.id === 'E1' || this.clock - this.lastEnd < 3) return;
      const l = this.fromPool('after'); if (l) this.say(l);
    });
    s.on('boss:start', (d) => { for (const l of this.byTrigger('boss:' + d.id)) this.say(l); });
    s.on('boss:phase', (d) => { for (const l of this.byTrigger('bossphase:' + d.phase)) this.say(l); });
    s.on('boss:dead', (d) => { for (const l of this.byTrigger('bossdead:' + d.id)) this.say(l); });
    s.on('shift', (d) => {
      this.lastShiftAt = this.clock;
      const first = this.byTrigger('shift:' + d.count)[0];
      if (first) { this.say(first); return; }
      const l = this.fromPool('shift', (x) => x.trigger === 'shift' || x.trigger === 'shift:' + d.to);
      if (l) this.say(l);
    });
    s.on('shift:deny', (d) => {
      if (d.at !== 'begin') return;
      const r = String(d.reason ?? '');
      const trig = /resonance/i.test(r) ? 'deny:resonance' : /stone/i.test(r) ? 'deny:stone' : /footing/i.test(r) ? 'deny:footing' : '';
      for (const l of this.byTrigger(trig)) this.say(l);
    });
    s.on('hero:death', () => this.stop(0.3));
  }

  // ------------------------------------------------------------------ lines
  private byTrigger(trigger: string) {
    const out: Line[] = [];
    for (const l of this.lines.values()) if (l.trigger === trigger && (l.floor === 0 || l.floor === this.floorId)) out.push(l);
    return out;
  }
  sayId(id: string) { const l = this.lines.get(id); if (l) this.say(l); }

  private fromPool(pool: string, filter?: (l: Line) => boolean): Line | null {
    const cfg = DATA.pools[pool];
    if (!cfg || this.clock - (this.poolAt.get(pool) ?? -1e9) < cfg.cooldown) return null;
    if (Math.random() > cfg.chance) return null;
    let seen = this.poolSeen.get(pool);
    if (!seen) this.poolSeen.set(pool, seen = new Set());
    const all = [...this.lines.values()].filter((l) => l.pool === pool && (l.floor === 0 || l.floor === this.floorId) && (!filter || filter(l)));
    let fresh = all.filter((l) => !seen!.has(l.id) && l.id !== this.poolLast.get(pool));
    if (!fresh.length) {
      if (pool === 'idle') return null; // each idle remark at most once per run
      for (const l of all) seen.delete(l.id);
      fresh = all.filter((l) => l.id !== this.poolLast.get(pool));
    }
    return fresh.length ? fresh[Math.floor(Math.random() * fresh.length)] : null;
  }

  private onFight(d: { id: string; boss?: boolean; kinds?: string[]; count?: number }) {
    const direct = this.byTrigger('encounter:' + d.id);
    if (direct.length) { for (const l of direct) this.say(l); return; }
    if (d.boss || this.clock - this.lastEnd < 6 && this.cur?.line.pri === 5) return;
    const kinds = d.kinds ?? [];
    if (this.clock - this.lastShiftAt < 2.5 && !this.played.has('shift_danger')) { this.sayId('shift_danger'); return; }
    if (kinds.some((k) => ARCHERS.has(k)) && this.clock - this.archerAt > 240) { this.archerAt = this.clock; this.sayId('cmb_archer'); return; }
    if (kinds.some((k) => HEAVY.has(k)) && !this.heavyFloors.has(this.floorId)) { this.heavyFloors.add(this.floorId); this.sayId('cmb_heavy'); return; }
    if ((d.count ?? 0) >= 5 && this.clock - this.manyAt > 300) { this.manyAt = this.clock; this.sayId('cmb_many'); return; }
    const l = this.fromPool('enter');
    if (l) this.say(l);
  }

  /** Ask for a line; the rules decide whether it plays now, waits, interrupts, or is dropped. */
  say(line: Line) {
    if (!this.enabled || this.g.finished) return;
    if (line.floor && line.floor !== this.floorId) return;
    if ((ONCE.has(line.cat) || line.id === 'shift_danger') && this.played.has(line.id)) return;
    if (this.cur?.line.id === line.id || this.pending?.line.id === line.id) return;
    if (this.cur) {
      if (this.cur.line.pri <= 2 && line.pri > this.cur.line.pri) this.stop(0.15);
      else { if (line.pri >= 3) this.enqueue(line); return; }
    }
    const gap = line.pri >= 5 ? 0.4 : 2.5;
    if (this.clock - this.lastEnd < gap) { if (line.pri >= 3) this.enqueue(line); return; }
    if (line.cat === 'combat' && this.clock - this.lastCombatAt < 25) return;
    this.start(line);
  }

  private enqueue(line: Line) {
    if (this.queue.some((q) => q.line.id === line.id)) return;
    this.queue.push({ line, at: this.clock });
    this.queue.sort((a, b) => b.line.pri - a.line.pri);
    if (this.queue.length > 2) this.queue.length = 2;
  }

  private start(line: Line) {
    // a moment that has passed: the first-kill wonder is moot once the sigil rite has spoken
    if (line.id === 'f1_first_kill' && this.played.has('f1_rite')) return;
    this.played.add(line.id);
    if (line.pool) {
      this.poolAt.set(line.pool, this.clock);
      this.poolLast.set(line.pool, line.id);
      this.poolSeen.get(line.pool)?.add(line.id);
    }
    if (line.cat === 'combat') this.lastCombatAt = this.clock;
    const key = 'vo:' + line.id;
    const m = this.g.assets.manager;
    if (!m.has(key) || this.g.audio.ctx?.state !== 'running') {
      // not resident (rare: prefetch runs ahead) or sound not unlocked yet (the first frame): fetch / wait, and
      // play if it is ready within 1.2 s — otherwise the subtitle alone
      this.pending = { line, until: this.clock + 1.2 };
      if (!m.has(key)) m.acquire('vo' + this.floorId, [key]).catch((e) => console.warn('[dialogue] load failed', line.id, e));
      return;
    }
    this.begin(line, m.get<AudioBuffer>(key));
  }

  private begin(line: Line, buf: AudioBuffer | null) {
    const a = this.g.audio;
    let src: AudioBufferSourceNode | null = null;
    const out = a.voiceOut();
    if (buf && a.ctx && out && a.ctx.state === 'running') {
      src = a.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(out);
      src.start();
      a.duck(true);
    }
    const dur = buf?.duration ?? VOICE[line.id]?.dur ?? Math.max(2, line.text.length / 14);
    this.cur = { line, src, until: this.clock + Math.max(dur, 1.2 + line.text.length / 22) + 0.15 };
    this.g.hud.subtitle(line.text);
    this.log.push({ id: line.id, t: +this.clock.toFixed(2), audio: !!src });
  }

  stop(fade = 0.15) {
    const c = this.cur;
    this.cur = null;
    this.pending = null;
    this.queue = [];
    if (c?.src) { const s = c.src; try { s.stop((this.g.audio.ctx?.currentTime ?? 0) + fade); } catch { /* ended */ } }
    this.g.audio.duck(false);
    this.g.hud.subtitle(null);
    this.lastEnd = this.clock;
  }

  // ------------------------------------------------------------------ floor residency
  /** Voice keys the floor loading screen should include: [shared (vo-core), this floor's boot lines]. */
  loadKeys(floorId: number): { core: string[]; floor: string[] } {
    if (!this.enabled) return { core: [], floor: [] };
    const core: string[] = [], floor: string[] = [];
    for (const l of DATA.lines) {
      if (!VOICE[l.id]) continue;
      if (l.floor === 0) core.push('vo:' + l.id);
      else if (l.floor === floorId && BOOT.has(l.cat)) floor.push('vo:' + l.id);
    }
    return { core, floor };
  }

  /** A floor was built: anchor its lazily loaded lines to where they will be triggered. */
  attach(floorId: number) {
    this.stop(0);
    this.floorId = floorId;
    this.floorT = 0;
    this.anchors = [];
    this.idleLines = [];
    const lv = this.g.level;
    const objs = OBJECTIVES[floorId] ?? [];
    for (const l of DATA.lines) {
      if (l.floor !== floorId || BOOT.has(l.cat) || !VOICE[l.id]) continue;
      let pos: THREE.Vector3 | null = null;
      if (l.trigger.startsWith('trace:')) pos = lv.markersOf('trace').find((m) => m.name === l.trigger.slice(6))?.pos ?? null;
      else if (l.cat === 'hint') { const o = objs.find((o) => o.hints?.some((h) => h.line === l.id)); if (o?.at) pos = b2t(o.at[0], o.at[1], o.at[2]); }
      else if (l.cat === 'boss') {
        const boss = l.trigger.split(':')[1];
        const enc = BOSS_ENCOUNTER[boss] ?? (floorId === 3 ? 'BOSS' : floorId === 2 ? 'E10' : 'E13');
        pos = lv.markersOf('encounter').find((m) => m.name === enc)?.pos ?? null;
      }
      if (pos) this.anchors.push({ id: l.id, pos: pos.clone() });
      else this.idleLines.push(l.id);
    }
  }

  /** Leaving a floor: its lazily loaded lines are released (shared barks stay). */
  release(floorId: number) {
    this.stop(0);
    return this.g.assets.manager.release('vo' + floorId);
  }

  private prefetch() {
    const m = this.g.assets.manager, p = this.g.player.pos;
    const want: string[] = [];
    for (const a of this.anchors) if (!this.played.has(a.id) && !m.has('vo:' + a.id) && a.pos.distanceTo(p) < PREFETCH) want.push('vo:' + a.id);
    // lines with no place (idle remarks) load quietly once the floor has settled
    if (this.floorT > 50) for (const id of this.idleLines) if (!this.played.has(id) && !m.has('vo:' + id)) want.push('vo:' + id);
    if (want.length) m.acquire('vo' + this.floorId, want).catch((e) => console.warn('[dialogue] prefetch failed', e));
  }

  // ------------------------------------------------------------------ per frame
  update(realDt: number) {
    if (!this.enabled) return;
    const dt = Math.min(realDt, 0.1);
    this.clock += dt;
    this.floorT += dt;
    const g = this.g;
    if (this.pending) {
      const key = 'vo:' + this.pending.line.id;
      const ready = g.audio.ctx?.state === 'running';
      if (g.assets.manager.has(key) && ready) { const l = this.pending.line; this.pending = null; this.begin(l, g.assets.manager.get<AudioBuffer>(key)); }
      else if (this.clock > this.pending.until) { const l = this.pending.line; this.pending = null; this.begin(l, null); }
    }
    if (this.cur && this.clock >= this.cur.until) {
      // a once-only line will never play again: free its decoded audio now (memory stays at the prefetch window)
      const done = this.cur.line;
      if (ONCE.has(done.cat) || done.cat === 'idle') g.assets.manager.evict('vo:' + done.id);
      this.cur = null;
      this.lastEnd = this.clock;
      g.audio.duck(false);
      g.hud.subtitle(null);
    }
    if (!this.cur && !this.pending && this.queue.length) {
      // tutorial / story lines wait longer for their turn than combat barks
      this.queue = this.queue.filter((q) => this.clock - q.at < (q.line.pri >= 4 ? 14 : 5));
      const q = this.queue[0];
      if (q && this.clock - this.lastEnd >= (q.line.pri >= 5 ? 0.4 : 1.2)) { this.queue.shift(); this.start(q.line); }
    }
    if ((this.prefetchT -= dt) <= 0) { this.prefetchT = 1; this.prefetch(); }
    // low health in a fight
    const p = g.player;
    if (p.alive && g.enemies.inCombat && p.hp / p.maxHp < 0.3 && !this.cur) { const l = this.fromPool('lowhp'); if (l) this.say(l); }
    // idle: long, genuine inactivity outside combat
    const acted = p.pos.distanceTo(this.idlePos) > 0.5 || g.learned.looked - this.idleLook > 0.05 || g.enemies.playerHits !== this.idleHits;
    if (acted || g.enemies.inCombat || !p.alive || g.paused || this.cur) {
      this.idleT = 0; this.idlePos.copy(p.pos); this.idleLook = g.learned.looked; this.idleHits = g.enemies.playerHits;
    } else this.idleT += dt;
    if (this.idleT > 30 && this.clock - this.lastEnd > 45 && (g.objectives?.nextHintIn() ?? 99) > 12) {
      this.idleT = 0;
      const l = this.fromPool('idle');
      if (l) this.say(l);
    }
  }
}
