import type { AchIcon, AchievementDef } from '../data/achievements';
import './achievements.css';

/**
 * Achievement icons (session 15): gilt line devices on a House Vaelor lozenge (the toast) or a round seal (the panel).
 * 24-unit viewBox, stroked with currentColor.
 */
export const ICONS: Record<AchIcon, string> = {
  gate: '<path d="M5 21V10a7 7 0 0 1 14 0v11"/><path d="M8.5 21V11.5M12 21V9.5M15.5 21V11.5M5.5 14h13M5.5 17.5h13"/>',
  crown: '<path d="M4 17 3 7l5 4 4-6 4 6 5-4-1 10Z"/><path d="M4.5 20h15"/><circle cx="12" cy="13.2" r="1.3"/>',
  heart: '<path d="M12 2.5 18 12l-6 9.5L6 12Z"/><path d="M12 2.5v19M6 12h12"/><circle cx="12" cy="12" r="8.6" opacity=".55"/>',
  mask: '<path d="M5 6c3-1.5 11-1.5 14 0 0 7-2.5 12.5-7 14.5C7.5 18.5 5 13 5 6Z"/><path d="M8.3 10.5c.9-.7 2-.7 2.8 0M12.9 10.5c.8-.7 1.9-.7 2.8 0M9.5 12.5c0 2 1 4 1 5.5M14.5 12.5c0 2-1 4-1 5.5"/>',
  fang: '<path d="M4 6c5 1 11 1 16 0-1 5-3 8-5 9l-3 6-3-6c-2-1-4-4-5-9Z"/><path d="M9 9.5 10 13M15 9.5 14 13"/>',
  shield: '<path d="M12 3 19 6v5.5c0 4.5-3 7.8-7 9.5-4-1.7-7-5-7-9.5V6Z"/><path d="M12 3v18M7.5 10.5h9"/>',
  sword: '<path d="M19.5 4.5 9 15M19.5 4.5 20 4l-.5 3.5L9.5 17.5"/><path d="M6.5 13.5l4 4M4 20l3.5-3.5"/><circle cx="4" cy="20" r="1"/>',
  blades: '<path d="M4 4 15 15M20 4 9 15"/><path d="M13 17l4-4M11 17l-4-4M16.5 17.5 19 20M7.5 17.5 5 20"/>',
  plunge: '<path d="M12 2.5v13M9.5 5.5h5"/><path d="M12 15.5 10.5 19h3Z"/><path d="M4 20.5c2.5-2 5-2.6 8-2.6s5.5.6 8 2.6M6.5 17c1.6-1 3.4-1.4 5.5-1.4s3.9.4 5.5 1.4" opacity=".7"/>',
  spiral: '<path d="M12 12.2c0-1 1.6-1.2 2 0 .6 1.9-1.6 3.3-3.3 2.3-2.5-1.4-1.9-5.2.7-5.9 3.6-1 6.4 2.6 5.3 5.9-1.3 4-6.3 5.3-9.6 3C3.2 15 4 8.3 8.2 5.8c4.5-2.7 10.6-.5 12 4.4"/>',
  ember: '<path d="M12 21c-3.6 0-6-2.6-6-6 0-4 3.5-5.5 3.8-10 2.4 1.6 3 3.9 2.8 5.8 1-.8 1.7-2 1.9-3.3C17 9.2 18 11.8 18 15c0 3.4-2.4 6-6 6Z"/><path d="M12 21c-1.6 0-2.7-1.1-2.7-2.7 0-1.9 1.6-2.6 2.1-4.3 1.9 1.1 3.3 2.7 3.3 4.3 0 1.6-1.1 2.7-2.7 2.7Z"/>',
  moons: '<circle cx="9" cy="12" r="6.5"/><path d="M15 5.8a6.5 6.5 0 0 1 0 12.4"/><path d="M12 3v18" stroke-dasharray="1.6 1.8"/>',
  hourglass: '<path d="M6 3h12M6 21h12M7.5 3c0 5 4.5 5.5 4.5 9s-4.5 4-4.5 9M16.5 3c0 5-4.5 5.5-4.5 9s4.5 4 4.5 9"/><path d="M9.5 18.5h5" opacity=".7"/>',
  scroll: '<path d="M7 4h11a2 2 0 0 1 0 4h-1v10a3 3 0 0 1-3 3H6a2 2 0 0 1 0-4h1Z"/><path d="M7 17V4M10 9.5h4.5M10 12.5h4.5M10 15.5h3"/>',
  letter: '<path d="M3.5 6.5h17v11h-17Z"/><path d="m3.5 6.5 8.5 7 8.5-7"/><circle cx="12" cy="15.8" r="2.1"/>',
  book: '<path d="M12 6.5C9.8 5 7 4.5 3.5 5v13.5c3.5-.5 6.3 0 8.5 1.5 2.2-1.5 5-2 8.5-1.5V5C17 4.5 14.2 5 12 6.5Z"/><path d="M12 6.5V20"/>',
  eye: '<path d="M2.5 12c2.5-4.3 5.8-6.5 9.5-6.5s7 2.2 9.5 6.5c-2.5 4.3-5.8 6.5-9.5 6.5S5 16.3 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>',
  skull: '<path d="M12 3c4.4 0 7.5 3 7.5 7.3 0 2.6-1.1 4.3-2.8 5.2V19h-2.2v-2h-1.5v2h-2v-2H9.5v2H7.3v-3.5C5.6 14.6 4.5 12.9 4.5 10.3 4.5 6 7.6 3 12 3Z"/><circle cx="9" cy="10.8" r="1.6"/><circle cx="15" cy="10.8" r="1.6"/>',
};

export function iconSVG(icon: AchIcon, cls = '') {
  return `<svg class="ach-ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[icon]}</svg>`;
}

/**
 * The unlock banner: a gilt lozenge sigil, "Achievement", the name and a line of what was done. It slides in, a band of
 * light crosses it, it holds ~4.6 s and leaves; several unlocks queue (one at a time). pointer-events: none — it never
 * takes a tap or a click, never pauses anything. The chime is AudioFX.achievement() (a soft synthesized bell).
 */
export class AchievementToast {
  private host: HTMLElement;
  private queue: AchievementDef[] = [];
  private busy = false;
  /** what was shown (tests) */
  shown: string[] = [];

  constructor(stage: HTMLElement, private chime: () => void) {
    this.host = document.createElement('div');
    this.host.className = 'ach-host';
    this.host.setAttribute('aria-live', 'polite');
    stage.appendChild(this.host);
  }

  show(a: AchievementDef) {
    this.queue.push(a);
    if (!this.busy) this.next();
  }

  private next() {
    const a = this.queue.shift();
    if (!a) { this.busy = false; return; }
    this.busy = true;
    this.shown.push(a.id);
    const el = document.createElement('div');
    el.className = 'ach-toast';
    el.innerHTML = `
      <div class="ach-seal"><svg class="ach-lozenge" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 2 46 24 24 46 2 24Z"/><path d="M24 7 41 24 24 41 7 24Z"/></svg>${iconSVG(a.icon)}</div>
      <div class="ach-text"><small>Achievement</small><b>${a.name}</b><span>${a.desc}</span></div>
      <i class="ach-sheen"></i>`;
    this.host.appendChild(el);
    this.chime();
    // enter on the next frame (a timeout, not rAF: a hidden pane / throttled tab must still show and clear it)
    setTimeout(() => el.classList.add('in'), 30);
    setTimeout(() => { el.classList.remove('in'); el.classList.add('out'); }, 4900);
    setTimeout(() => { el.remove(); this.next(); }, 5600);
  }
}
