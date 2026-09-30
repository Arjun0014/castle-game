import { Platform } from '../platform/Platform';
import { CREDITS } from '../data/credits';
import type { Settings, SettingsData } from '../game/Settings';
import type { Guidance, SaveData } from '../game/Save';
import { sigilSVG } from './LoadingScreen';
import './menu.css';

/**
 * The title screen (session 10): the game's name over the loaded castle (a slow shot of the gate, Game.menuScene),
 * and the menu — Continue (a floor reached before), New Game (→ Guided or Minimal guidance), Controls, Settings,
 * Credits. Mouse, touch and keyboard (↑/↓ or W/S, Enter, Esc) all drive it. The same panels (Controls, Settings)
 * open from the pause menu in play (PauseMenu).
 */
export type UiSound = 'move' | 'select' | 'back';

interface MenuHooks {
  settings: Settings;
  save: SaveData | null;
  onNewGame(guidance: Guidance): void;
  onContinue(): void;
  sound(kind: UiSound): void;
  /** first user gesture on the menu (resume the audio context for the menu's sounds) */
  onGesture(): void;
}

const ROMAN: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III' };
const FLOOR_NAME: Record<number, string> = { 1: 'Inheritance', 2: 'Complicity', 3: 'The Crownheart' };

// ------------------------------------------------------------------ shared panel content
const KBM: [string, string][] = [
  ['Move', 'W A S D'], ['Look', 'Mouse'], ['Sprint', 'Hold Shift'], ['Dodge', 'Tap Shift'], ['Jump', 'Space'], ['Crouch', 'C'],
  ['Light attack', 'Left click'], ['Heavy attack', 'Right click'], ['Guard', 'Hold Q'], ['Parry', 'Tap Q as a blow lands'],
  ['Shield bash', 'Q + Left click'], ['Kick', 'F'], ['Time shift', 'Hold R'], ['Interact', 'E'], ['Lock on', 'Tab'], ['Pause', 'Esc'], ['Mute', 'M'],
];
const TOUCH: [string, string][] = [
  ['Move', 'Left thumb — push to the rim to sprint'], ['Look', 'Drag anywhere else'], ['Light attack', 'ATTACK'], ['Heavy attack', 'HEAVY'],
  ['Guard / parry', 'Hold GUARD — tap it as a blow lands'], ['Shield bash', 'GUARD + ATTACK'], ['Kick', 'GUARD + HEAVY'], ['Jump', 'JUMP'],
  ['Time shift', 'Hold the blue SHIFT seal'], ['Crouch', 'Automatic under low ceilings'], ['Interact', 'Tap the card that appears'], ['Pause', 'Top-right seal'],
];
const COMBAT_NOTES: [string, string][] = [
  ['Chain', 'Keep striking as each blow lands — up to five cuts'],
  ['Second route', 'Pause a beat between strikes for the Great Sword chain'],
  ['Finisher', 'End any chain with a heavy blow'],
  ['Riposte', 'Parry, then strike at once'],
  ['Execution', 'Heavy beside a staggered, wounded foe'],
  ['Resonance', 'Destroyed Echoes fill it; one full segment = one shift'],
];

export function controlsHTML(touchFirst: boolean) {
  const rows = (list: [string, string][]) => list.map(([a, b]) => `<div class="mm-row"><span>${a}</span><b>${b}</b></div>`).join('');
  return `
    <div class="mm-tabs" role="tablist">
      <button class="mm-tab${touchFirst ? '' : ' on'}" data-tab="kbm">Keyboard &amp; mouse</button>
      <button class="mm-tab${touchFirst ? ' on' : ''}" data-tab="touch">Touch</button>
    </div>
    <div class="mm-tabpage${touchFirst ? '' : ' on'}" data-page="kbm">${rows(KBM)}
      <div class="mm-note">Earned later: <b>hold Right click</b> — Crownbreaker (Floor II) · <b>hold Left click</b> — Whirlwind (Floor III)</div></div>
    <div class="mm-tabpage${touchFirst ? ' on' : ''}" data-page="touch">${rows(TOUCH)}
      <div class="mm-note">Earned later: <b>hold HEAVY</b> — Crownbreaker (Floor II) · <b>hold ATTACK</b> — Whirlwind (Floor III)</div></div>
    <h4 class="mm-h4">The sword</h4>${rows(COMBAT_NOTES)}`;
}

export function wireTabs(root: HTMLElement) {
  root.querySelectorAll<HTMLButtonElement>('.mm-tab').forEach((t) => t.addEventListener('click', () => {
    root.querySelectorAll('.mm-tab').forEach((x) => x.classList.toggle('on', x === t));
    root.querySelectorAll<HTMLElement>('.mm-tabpage').forEach((p) => p.classList.toggle('on', p.dataset.page === t.dataset.tab));
  }));
}

const SLIDERS: { key: keyof SettingsData; label: string; min: number; max: number; step: number; pct?: boolean }[] = [
  { key: 'master', label: 'Master volume', min: 0, max: 1, step: 0.05, pct: true },
  { key: 'score', label: 'Music', min: 0, max: 1.5, step: 0.05, pct: true },
  { key: 'music', label: 'Ambience', min: 0, max: 1.5, step: 0.05, pct: true },
  { key: 'sfx', label: 'Effects', min: 0, max: 1.5, step: 0.05, pct: true },
  { key: 'voice', label: 'Voice', min: 0, max: 1.5, step: 0.05, pct: true },
  { key: 'look', label: 'Camera sensitivity', min: 0.4, max: 2, step: 0.05 },
  { key: 'shake', label: 'Camera shake', min: 0, max: 1.5, step: 0.05, pct: true },
];

export function settingsHTML() {
  return SLIDERS.map((s) => `
    <label class="mm-slider" data-key="${s.key}"><span>${s.label}</span>
      <input type="range" min="${s.min}" max="${s.max}" step="${s.step}"><output></output></label>`).join('')
    + `<div class="mm-toggle" data-key="subtitles" role="switch" tabindex="-1"><span>Subtitles</span><b></b></div>
       <button class="mm-reset" type="button">Restore defaults</button>`;
}

export function wireSettings(root: HTMLElement, settings: Settings, sound: (k: UiSound) => void) {
  const paint = () => {
    for (const s of SLIDERS) {
      const el = root.querySelector<HTMLElement>(`.mm-slider[data-key="${s.key}"]`)!;
      const inp = el.querySelector('input')!, out = el.querySelector('output')!;
      const v = settings.data[s.key] as number;
      inp.value = String(v);
      out.textContent = s.pct ? `${Math.round(v * 100)}%` : `${v.toFixed(2)}×`;
      el.style.setProperty('--fill', `${((v - s.min) / (s.max - s.min)) * 100}%`);
    }
    const t = root.querySelector<HTMLElement>('.mm-toggle[data-key="subtitles"]')!;
    t.classList.toggle('on', settings.data.subtitles);
    t.querySelector('b')!.textContent = settings.data.subtitles ? 'On' : 'Off';
  };
  for (const s of SLIDERS) {
    const inp = root.querySelector<HTMLInputElement>(`.mm-slider[data-key="${s.key}"] input`)!;
    inp.addEventListener('input', () => { settings.set(s.key, Number(inp.value) as never); paint(); });
    inp.addEventListener('change', () => sound('move'));
  }
  root.querySelector('.mm-toggle[data-key="subtitles"]')!.addEventListener('click', () => { settings.set('subtitles', !settings.data.subtitles); paint(); sound('select'); });
  root.querySelector('.mm-reset')!.addEventListener('click', () => { settings.reset(); paint(); sound('back'); });
  paint();
}

export function creditsHTML() {
  return CREDITS.map((s) => `
    <section class="mm-cred${s.byline ? ' mm-cred-top' : ''}">
      <h4 class="mm-h4">${s.title}</h4>
      ${s.byline ? `<div class="mm-cred-by"><span>A game by</span><b>${s.byline}</b></div>` : ''}
      ${s.statement ? `<div class="mm-cred-statement">${s.statement.map((p) => `<p>${p}</p>`).join('')}</div>` : ''}
      ${s.intro ? `<p class="mm-cred-intro">${s.intro}</p>` : ''}
      ${s.lines.map((l) => `<div class="mm-cred-line"><span>${l.what}</span><b>${l.who}${l.note ? ` <i>${l.note}</i>` : ''}</b>${l.url ? `<small>${l.url.replace(/^https:\/\//, '')}</small>` : ''}</div>`).join('')}
    </section>`).join('') + '<p class="mm-cred-end">Caer Veyr remembers you.</p>';
}

// ------------------------------------------------------------------ the title screen
export class MainMenu {
  root: HTMLDivElement;
  private list: HTMLElement;
  private panels = new Map<string, HTMLElement>();
  private panel: string | null = null;
  private focusIdx = 0;
  private guidance: Guidance = 'guided';
  private gestured = false;
  private open = false;

  constructor(stage: HTMLElement, private h: MenuHooks) {
    const cont = h.save ? `<button class="mm-item" data-act="continue"><span>Continue</span><small>Floor ${ROMAN[h.save.floor]} · ${FLOOR_NAME[h.save.floor]}</small></button>` : '';
    const root = this.root = document.createElement('div');
    root.id = 'menu';
    root.className = 'mm hidden';
    root.innerHTML = `
      <div class="mm-shade"></div>
      <div class="mm-head">
        <div class="mm-crest">${sigilSVG('mm')}</div>
        <h1 class="mm-title" aria-label="Echoes of Caer Veyr"><span>ECHOES OF</span><span>CAER VEYR</span></h1>
        <div class="mm-rule"><i></i><b>◆</b><i></i></div>
        <div class="mm-tag">The castle remembers · a keep torn between two memories</div>
      </div>
      <nav class="mm-list">
        ${cont}
        <button class="mm-item" data-act="new"><span>New Game</span></button>
        <button class="mm-item" data-act="controls"><span>Controls</span></button>
        <button class="mm-item" data-act="settings"><span>Settings</span></button>
        <button class="mm-item" data-act="credits"><span>Credits</span></button>
      </nav>
      <div class="mm-foot"><span class="mm-keys">↑ ↓ choose · Enter confirm · Esc back</span></div>
      ${this.panelHTML('guidance', 'New game', `
        <p class="mm-lead">How much should the castle teach you?</p>
        <div class="mm-choices">
          <button class="mm-choice on" data-guide="guided"><b>Guided</b><span>The castle teaches each skill in turn — moving, the sword, guard and parry, the Blood Sigils, Resonance, the time shift, crouching — pausing to let you try each one.</span></button>
          <button class="mm-choice" data-guide="minimal"><b>Minimal guidance</b><span>For those who know a blade. Objectives, the way forward and how the castle's two memories work — no combat lessons.</span></button>
        </div>
        <button class="mm-begin" type="button">Enter the keep</button>`)}
      ${this.panelHTML('controls', 'Controls', controlsHTML(Platform.isTouch))}
      ${this.panelHTML('settings', 'Settings', settingsHTML())}
      ${this.panelHTML('credits', 'Credits', creditsHTML())}`;
    stage.appendChild(root);
    this.list = root.querySelector('.mm-list')!;
    root.querySelectorAll<HTMLElement>('.mm-panel').forEach((p) => this.panels.set(p.dataset.panel!, p));
    wireTabs(this.panels.get('controls')!);
    wireSettings(this.panels.get('settings')!, h.settings, h.sound);
    this.items().forEach((b, i) => {
      b.addEventListener('pointerenter', () => { if (!this.panel && this.focusIdx !== i) { this.focusIdx = i; this.paintFocus(); h.sound('move'); } });
      b.addEventListener('click', () => this.activate(b.dataset.act!));
    });
    root.querySelectorAll<HTMLButtonElement>('.mm-choice').forEach((c) => {
      c.addEventListener('click', () => { this.setGuidance(c.dataset.guide as Guidance); h.sound('move'); });
      c.addEventListener('dblclick', () => this.begin());
    });
    root.querySelector('.mm-begin')!.addEventListener('click', () => this.begin());
    root.querySelectorAll<HTMLButtonElement>('.mm-back').forEach((b) => b.addEventListener('click', () => this.closePanel()));
    root.addEventListener('pointerdown', () => this.gesture(), true);
    window.addEventListener('keydown', this.onKey, true);
    this.paintFocus();
  }

  private panelHTML(id: string, title: string, body: string) {
    return `<section class="mm-panel" data-panel="${id}">
      <div class="mm-frame"><header><h2>${title}</h2><button class="mm-back" type="button" aria-label="Back">Back</button></header>
      <div class="mm-body">${body}</div></div></section>`;
  }

  private items() { return [...this.list.querySelectorAll<HTMLButtonElement>('.mm-item')]; }

  show() {
    this.open = true;
    this.root.classList.remove('hidden');
    requestAnimationFrame(() => this.root.classList.add('in'));
  }

  hide() {
    this.open = false;
    this.root.classList.remove('in');
    this.root.classList.add('out');
    window.removeEventListener('keydown', this.onKey, true);
    setTimeout(() => this.root.remove(), 900);
  }

  private gesture() {
    if (this.gestured) return;
    this.gestured = true;
    this.h.onGesture();
  }

  private setGuidance(g: Guidance) {
    this.guidance = g;
    this.root.querySelectorAll<HTMLElement>('.mm-choice').forEach((c) => c.classList.toggle('on', c.dataset.guide === g));
  }

  private activate(act: string) {
    this.gesture();
    if (act === 'continue') { this.h.sound('select'); this.h.onContinue(); return; }
    if (act === 'new') { this.openPanel('guidance'); return; }
    this.openPanel(act);
  }

  private begin() {
    this.gesture();
    this.h.sound('select');
    this.h.onNewGame(this.guidance);
  }

  private openPanel(id: string) {
    const p = this.panels.get(id);
    if (!p) return;
    this.h.sound('select');
    this.panel = id;
    this.root.classList.add('panel-on');
    this.panels.forEach((x, k) => x.classList.toggle('on', k === id));
    const body = p.querySelector('.mm-body') as HTMLElement;
    body.scrollTop = 0;
  }

  private closePanel() {
    if (!this.panel) return;
    this.h.sound('back');
    this.panel = null;
    this.root.classList.remove('panel-on');
    this.panels.forEach((x) => x.classList.remove('on'));
  }

  private paintFocus() {
    this.items().forEach((b, i) => b.classList.toggle('focus', i === this.focusIdx));
  }

  private onKey = (e: KeyboardEvent) => {
    if (!this.open || document.documentElement.classList.contains('intro-on')) return;
    const k = e.code;
    const nav = ['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS', 'Enter', 'NumpadEnter', 'Space', 'Escape', 'ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'];
    if (!nav.includes(k)) return;
    e.preventDefault();
    e.stopPropagation();
    this.gesture();
    if (this.panel) {
      if (k === 'Escape') { this.closePanel(); return; }
      if (this.panel === 'guidance') {
        if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'KeyA' || k === 'KeyW') { this.setGuidance('guided'); this.h.sound('move'); }
        else if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'KeyD' || k === 'KeyS') { this.setGuidance('minimal'); this.h.sound('move'); }
        else if (k === 'Enter' || k === 'NumpadEnter' || k === 'Space') this.begin();
        return;
      }
      const body = this.panels.get(this.panel)?.querySelector('.mm-body') as HTMLElement | null;
      if (body && (k === 'ArrowDown' || k === 'KeyS')) body.scrollBy({ top: 80, behavior: 'smooth' });
      if (body && (k === 'ArrowUp' || k === 'KeyW')) body.scrollBy({ top: -80, behavior: 'smooth' });
      return;
    }
    const n = this.items().length;
    if (k === 'ArrowUp' || k === 'KeyW') { this.focusIdx = (this.focusIdx + n - 1) % n; this.paintFocus(); this.h.sound('move'); }
    else if (k === 'ArrowDown' || k === 'KeyS') { this.focusIdx = (this.focusIdx + 1) % n; this.paintFocus(); this.h.sound('move'); }
    else if (k === 'Enter' || k === 'NumpadEnter' || k === 'Space') this.activate(this.items()[this.focusIdx].dataset.act!);
  };
}

// ------------------------------------------------------------------ in play: the pause menu
export class PauseMenu {
  root: HTMLDivElement;
  private panel: string | null = null;
  onResume?: () => void;
  onQuit?: () => void;

  constructor(host: HTMLElement, settings: Settings, private sound: (k: UiSound) => void) {
    const root = this.root = document.createElement('div');
    root.className = 'pm';
    root.innerHTML = `
      <div class="pm-card">
        <div class="pm-crest">${sigilSVG('pm')}</div>
        <div class="pm-game">Echoes of Caer Veyr</div>
        <h3>Paused</h3>
        <nav class="pm-list">
          <button class="mm-item focus" data-act="resume"><span>Resume</span></button>
          <button class="mm-item" data-act="controls"><span>Controls</span></button>
          <button class="mm-item" data-act="settings"><span>Settings</span></button>
          <button class="mm-item" data-act="quit"><span>Quit to title</span></button>
        </nav>
        <p class="pm-note">Progress is kept at the start of each floor.</p>
      </div>
      <section class="mm-panel" data-panel="controls"><div class="mm-frame"><header><h2>Controls</h2><button class="mm-back" type="button">Back</button></header><div class="mm-body">${controlsHTML(Platform.isTouch)}</div></div></section>
      <section class="mm-panel" data-panel="settings"><div class="mm-frame"><header><h2>Settings</h2><button class="mm-back" type="button">Back</button></header><div class="mm-body">${settingsHTML()}</div></div></section>`;
    host.appendChild(root);
    wireTabs(root.querySelector('[data-panel="controls"]') as HTMLElement);
    wireSettings(root.querySelector('[data-panel="settings"]') as HTMLElement, settings, sound);
    root.querySelectorAll<HTMLButtonElement>('.pm-list .mm-item').forEach((b) => {
      b.addEventListener('pointerenter', () => { root.querySelectorAll('.pm-list .mm-item').forEach((x) => x.classList.toggle('focus', x === b)); });
      b.addEventListener('click', (e) => { e.stopPropagation(); this.act(b.dataset.act!); });
    });
    root.querySelectorAll('.mm-back').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); this.closePanel(); }));
    // clicks on the card or a panel never fall through to the game (which would resume)
    root.addEventListener('click', (e) => e.stopPropagation());
  }

  /** Esc while a panel is open closes the panel instead of resuming. Returns true when it consumed the key. */
  back(): boolean {
    if (!this.panel) return false;
    this.closePanel();
    return true;
  }

  reset() { this.closePanel(true); }

  private act(a: string) {
    if (a === 'resume') { this.sound('select'); this.onResume?.(); return; }
    if (a === 'quit') { this.sound('back'); this.onQuit?.(); return; }
    this.sound('select');
    this.panel = a;
    this.root.classList.add('panel-on');
    this.root.querySelectorAll<HTMLElement>('.mm-panel').forEach((p) => p.classList.toggle('on', p.dataset.panel === a));
  }

  private closePanel(silent = false) {
    if (!this.panel) return;
    if (!silent) this.sound('back');
    this.panel = null;
    this.root.classList.remove('panel-on');
    this.root.querySelectorAll('.mm-panel').forEach((p) => p.classList.remove('on'));
  }
}
