import * as THREE from 'three';
import type { Game } from '../game/Game';
import type { TimeState } from '../levels/Materials';
import type { Enemy } from './Enemy';
import { ARCHETYPES, KILL_TIER, MONSTER_RIGS, PAST_COUNTERPART, type ArchetypeId } from './EnemyTypes';

/**
 * Memory-return reinforcements (session 14). A fight won in one memory does not stay empty forever: shift away and,
 * later, come back to that memory there, and the castle may remember a few of its Echoes — a SMALL group (2–4) of the
 * kind that fought there rises again. It keeps revisits alive without making time shifting a farm:
 *
 *  · only areas that had a fight IN THAT MEMORY (never the tutorial fight, a boss / mini-boss arena or the finale);
 *  · never a boss or mini-boss; at most one elite a group; the Past of Floors 1–2 never gets a monster (the living
 *    castle has none — PAST_COUNTERPART maps any to its human kin);
 *  · a group needs: the area's fight over for `sinceClear` s, the hero away in the other memory for `awayMin` s,
 *    `areaCooldown` s since this area's last group, `globalCooldown` s since any group, at most `maxPerArea` groups an
 *    area, no fight already on her, and a `chance` roll (a quiet return is tried again after half the cooldown);
 *  · the bodies are the floor's own fallen (EnemyManager.revive): built with the floor, drawn in its GPU warm-up —
 *    nothing is cloned, compiled or uploaded when they rise;
 *  · they give back 60 % of the usual Resonance and health (KILL_HEAL_REINFORCED).
 */
export const REINFORCE = {
  sinceClear: 40, awayMin: 6, areaCooldown: 100, globalCooldown: 45, maxPerArea: 2, chance: 0.7,
  /** the hero must arrive within this of the area's volume (m) */
  reach: 8,
  /** risers keep at least this far from her, at most this far (m) */
  minDist: 6.5, maxDist: 26,
  size: [2, 4] as [number, number],
};

/** elites and bosses come back as their rank and file (at most one elite a group) */
const RANK: Partial<Record<ArchetypeId, ArchetypeId>> = {
  gate_warden: 'guard', kingsguard: 'guard', goblin_king: 'goblin', widow_mother: 'widow', maw: 'crown_brute', last_crown: 'remnant',
};

interface Area {
  id: string; enc: string; state: TimeState; box: THREE.Box3; center: THREE.Vector3;
  /** the archetypes that fought here in this memory (after RANK / the Past rule) */
  kinds: ArchetypeId[];
  cleared: boolean; clearedAt: number; groups: number; lastAt: number;
}

export class Reinforcements {
  areas: Area[] = [];
  private enteredAt: Record<TimeState, number> = { PAST: 0, PRESENT: 0 };
  private lastAt = -1e9;
  private n = 0;
  private offs: (() => void)[] = [];
  /** tests: every decision */
  log: { t: number; area: string; result: string }[] = [];
  /** tests: force the next eligible return to spawn (skips the chance roll and the cooldowns) */
  force = false;

  constructor(private g: Game) {
    const em = g.enemies;
    for (const enc of em.encounters.values()) {
      if (enc.tutorial || enc.finale || enc.bossFight || enc.reinforce) continue;
      for (const st of ['PAST', 'PRESENT'] as TimeState[]) {
        if (enc.state !== st && enc.state !== 'BOTH') continue;
        const own = enc.enemies.filter((e) => (e.owner === st || e.owner === 'BOTH') && !e.arch.boss);
        if (!own.length) continue;
        const kinds = [...new Set(own.map((e) => this.kindFor(e.arch.id, st)))].filter((k): k is ArchetypeId => !!k && em.canRevive(k));
        if (!kinds.length) continue;
        const center = new THREE.Vector3();
        for (const e of own) center.add(e.home);
        center.divideScalar(own.length);
        this.areas.push({ id: `${enc.id}:${st}`, enc: enc.id, state: st, box: enc.box.clone(), center, kinds, cleared: enc.cleared, clearedAt: 0, groups: 0, lastAt: -1e9 });
      }
    }
    this.offs.push(g.signals.on('encounter:clear', (d) => {
      for (const a of this.areas) if (a.enc === d.id) { a.cleared = true; a.clearedAt = g.t; }
    }));
    this.offs.push(g.signals.on('shift', (d) => this.onShift(d.to as TimeState)));
    this.enteredAt[g.time.state] = g.t;
  }

  dispose() { for (const o of this.offs) o(); this.offs = []; }

  /** the archetype that comes back for `id` in memory `st` (null = none) */
  private kindFor(id: ArchetypeId, st: TimeState): ArchetypeId | null {
    let k: ArchetypeId = RANK[id] ?? id;
    if (st === 'PAST' && MONSTER_RIGS.has(ARCHETYPES[k].asset)) k = PAST_COUNTERPART[k] ?? 'guard';
    if (ARCHETYPES[k].boss) return null;
    return k;
  }

  private onShift(to: TimeState) {
    const g = this.g, now = g.t, p = g.player.pos;
    const from: TimeState = to === 'PAST' ? 'PRESENT' : 'PAST';
    const away = now - this.enteredAt[from];
    this.enteredAt[to] = now;
    const note = (area: string, result: string) => { this.log.push({ t: +now.toFixed(1), area, result }); if (this.log.length > 60) this.log.shift(); };
    if (!g.player.alive || g.tutorial?.active || g.finisher.active || g.player.scripted) return;
    const em = g.enemies;
    if (em.boss && em.boss.triggered && em.boss.alive) return;
    const force = this.force;
    // (her own arrival is the test: an area she is in, or at the edge of)
    const near = this.areas.filter((a) => a.state === to && a.cleared && a.box.distanceToPoint(p) <= REINFORCE.reach)
      .sort((a, b) => a.box.distanceToPoint(p) - b.box.distanceToPoint(p) || a.center.distanceTo(p) - b.center.distanceTo(p));
    const a = near[0];
    if (!a) return;
    if (!force) {
      if (away < REINFORCE.awayMin) { note(a.id, `away only ${away.toFixed(1)} s`); return; }
      if (now - a.clearedAt < REINFORCE.sinceClear) { note(a.id, 'cleared too recently'); return; }
      if (a.groups >= REINFORCE.maxPerArea) { note(a.id, 'area spent'); return; }
      if (now - a.lastAt < REINFORCE.areaCooldown) { note(a.id, 'area cooldown'); return; }
      if (now - this.lastAt < REINFORCE.globalCooldown) { note(a.id, 'global cooldown'); return; }
      if (em.engagedNear(p, 22)) { note(a.id, 'already fighting'); return; }
      if (Math.random() > REINFORCE.chance) { a.lastAt = now - REINFORCE.areaCooldown * 0.5; note(a.id, 'quiet this time'); return; }
    }
    this.force = false;
    const got = this.spawn(a, to);
    note(a.id, got ? `rose: ${got.join(', ')}` : 'no body could rise');
  }

  /** raise a small group for `a` in memory `st`; returns the archetypes (null = nothing could rise) */
  private spawn(a: Area, st: TimeState): string[] | null {
    const g = this.g, em = g.enemies, p = g.player.pos;
    const [lo, hi] = REINFORCE.size;
    const want = Math.min(hi, lo + (a.kinds.length > 1 ? 1 : 0) + (Math.random() < 0.35 ? 1 : 0));
    // bodies: this area's own fallen first (they rise where they fell), then the same kinds from anywhere on the floor
    const kinds = new Set(a.kinds);
    const cands = em.fallen([...kinds], a.center, st).filter((e) => {
      const d = e.home.distanceTo(p);
      return d >= REINFORCE.minDist && d <= REINFORCE.maxDist && (e.origEncounter ?? e.encounter) === a.enc;
    });
    const group: Enemy[] = [];
    let elites = 0;
    const take = (e: Enemy) => {
      if (group.includes(e) || group.length >= want) return;
      const k = this.kindFor(e.arch.id, st);
      if (k !== e.arch.id) return;                         // (a body is only ever its own kind)
      const elite = KILL_TIER[e.arch.id] === 'elite';
      if (elite && elites >= 1) return;
      if (elite) elites++;
      group.push(e);
    };
    // variety: one of each kind first, then fill
    for (const k of kinds) { const e = cands.find((x) => x.arch.id === k && !group.includes(x)); if (e) take(e); }
    for (const e of cands) take(e);
    // not enough of the area's own: the same kinds, fallen elsewhere, rise at the area's spots
    const spots: THREE.Vector3[] = [];
    if (group.length < lo) {
      const pts = em.walkableAround(a.center, st, 6, 14, REINFORCE.minDist);
      for (const e of em.fallen([...kinds], a.center, st)) {
        if (group.length >= Math.max(lo, want) || !pts.length) break;
        if (group.includes(e) || e.opts.perch) continue;
        const before = group.length;
        take(e);
        if (group.length > before) spots[group.length - 1] = pts.shift()!;
      }
    }
    if (group.length < lo) return null;
    const id = `R${++this.n}`;
    em.openGroup(id, st, a.center, group.map((e, i) => ({ e, at: spots[i] ?? null })), { reinforced: true });
    a.groups++;
    a.lastAt = g.t;
    this.lastAt = g.t;
    g.hud.prompt('The castle remembers them — Echoes rise again.', 3.2);
    g.audio.play('resonance' as never, { vol: 0.5, rate: 0.62 });
    g.signals.emit('reinforce', { id, area: a.id, kinds: group.map((e) => e.arch.id) });
    return group.map((e) => e.arch.id);
  }
}
