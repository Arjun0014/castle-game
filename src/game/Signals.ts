/**
 * Gameplay signals: a tiny synchronous event bus the presentation layers listen to (objectives, the heroine's
 * dialogue, tutorials) so gameplay code only announces what happened and never needs to know who reacts.
 *
 *   sigil:near {cid}            the hero came close to a sigil she has not activated
 *   sigil:activate {cid, first, firstEver}
 *   sigil:blocked {cid, why}    tried to use a sigil that is cooling / in combat
 *   trace {tid}                 examined a memory trace
 *   shift {to, count}           a completed shift (count = shifts this game)
 *   shift:deny {reason}
 *   encounter:start {id} · encounter:clear {id}
 *   kill {arch, boss, execution}
 *   boss:start {id} · boss:phase {id, phase} · boss:dead {id}
 *   hero:hurt {hp, max} · hero:death · hero:respawn
 *   fracture {id} · floor:start {id} · objective {id}
 *   reinforce {id, area, kinds}   a memory-return group rose (enemies/Reinforcements.ts)
 *   hit {attack, serial, index}   one of her blows connected (session 15: achievements)
 *   parry · floor:arrive {id, deaths} · floor:leave {id, next, deaths}   (session 15)
 *   finisher {id, enemy, last} · ability {id, phase}
 */
export type SignalData = Record<string, any>;
type Listener = (data: SignalData) => void;

export class Signals {
  private map = new Map<string, Listener[]>();
  on(name: string, fn: Listener) {
    let l = this.map.get(name);
    if (!l) this.map.set(name, l = []);
    l.push(fn);
    return () => { const a = this.map.get(name); if (a) a.splice(a.indexOf(fn), 1); };
  }
  emit(name: string, data: SignalData = {}) {
    const l = this.map.get(name);
    if (l) for (const fn of [...l]) fn(data);
  }
  clear() { this.map.clear(); }
}
