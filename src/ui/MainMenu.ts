import { Platform } from '../platform/Platform';
import { CREDITS } from '../data/credits';
import type { Settings, SettingsData } from '../game/Settings';
import { saveLabel, type Guidance, type SaveData } from '../game/Save';
import type { Player } from '../platform/Wavedash';
import type { CloudSave, CloudStatus } from '../platform/CloudSave';
import { CLOUD_GLYPH } from './SaveIndicator';
import { sigilSVG } from './LoadingScreen';
import { ACHIEVEMENTS, ACH_GROUPS } from '../data/achievements';
import type { Achievements } from '../game/Achievements';
import { iconSVG } from './AchievementToast';
import './menu.css';
import '@fontsource/cormorant-garamond/latin-700.css';

/**
 * The title screen (session 10): the game's name over the loaded castle (a slow shot of the gate, Game.menuScene),
 * and the menu — Continue (a floor reached before), New Game (→ Guided or Minimal guidance), Controls, Settings,
 * Credits. Mouse, touch and keyboard (↑/↓ or W/S, Enter, Esc) all drive it. The same panels (Controls, Settings)
 * open from the pause menu in play (PauseMenu).
 *
 * Session 15: three tiers so the list stays short — the way in (Continue / New Game), the book and the deeds (Lore ·
 * Achievements, a pair with their devices), and the quiet row (Controls · Settings · Credits). The keyboard moves by
 * row (↑/↓) and along a row (←/→). Lore opens the narrated chronicle (ui/LoreBook.ts, main.ts); Achievements a panel.
 *
 * Session 16 (Wavedash): Continue names the floor AND the Blood Sigil and can change under the title (a newer cloud copy
 * arrives: setSave); a quiet "Playing as" chip shows the Wavedash player (name + avatar, nothing outside Wavedash) with
 * the cloud save's state; Settings gains Display (Fullscreen) and the cloud line.
 */
export type UiSound = 'move' | 'select' | 'back';

interface MenuHooks {
  settings: Settings;
  save: SaveData | null;
  onNewGame(guidance: Guidance): void;
  onContinue(save: SaveData): void;
  sound(kind: UiSound): void;
  /** first user gesture on the menu (resume the audio context for the menu's sounds) */
  onGesture(): void;
  /** Lore: open the chronicle (main.ts → LoreBook) */
  onLore(): void;
  achievements: Achievements;
  /** the Wavedash player (null outside Wavedash: a local game, no chip) */
  player?: Player | null;
  cloud?: CloudSave;
}

/** the cloud save's state in words (the title chip, Settings) */
export function cloudWords(c: CloudSave | undefined): { cls: CloudStatus; text: string } | null {
  if (!c?.enabled) return null;
  const at = c.lastSync ? new Date(c.lastSync).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
  const text: Record<CloudStatus, string> = {
    local: 'Saved on this device', checking: 'Checking the cloud save…', saving: 'Saving to the cloud…',
    synced: at ? `Cloud save · ${at}` : 'Cloud save', offline: 'Offline · saved on this device', conflict: 'Two saves disagree',
  };
  return { cls: c.status, text: text[c.status] };
}

// ------------------------------------------------------------------ shared panel content
const KBM: [string, string][] = [
  ['Move', 'W A S D'], ['Look', 'Mouse'], ['Sprint', 'Hold Shift'], ['Dodge', 'Tap Shift'], ['Jump', 'Space'], ['Crouch', 'C'],
  ['Light attack', 'Left click'], ['Heavy attack', 'Right click'], ['Guard', 'Hold Q'], ['Parry', 'Tap Q as a blow lands'],
  ['Shield bash', 'Q + Left click'], ['Kick', 'F'], ['Time shift', 'Hold R'], ['Interact', 'E'], ['Lock on', 'Tab'], ['Pause', 'Esc'], ['Mute', 'M'],
];
const TOUCH: [string, string][] = [
  ['Move', 'Left thumb — push to the rim to sprint'], ['Look', 'Drag anywhere else'], ['Light attack', 'ATTACK'], ['Heavy attack', 'HEAVY'],
  ['Guard / parry', 'Hold GUARD — tap it as a blow lands'], ['Shield bash', 'GUARD + ATTACK'], ['Kick', 'GUARD + HEAVY'], ['Jump', 'JUMP'],
  ['Time shift', 'Hold the blue SHIFT seal'], ['Crouch', 'Automatic under low ceilings'], ['Interact', 'Tap the red button that appears over it'], ['Pause', 'Top-right seal'],
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

/**
 * Display (session 16): Fullscreen wherever the page can ask for it — on Wavedash through the platform (its overlay stays
 * on top), elsewhere the browser's own. (Phones play landscape only: there is no Portrait / Landscape choice.)
 */
function displayHTML() {
  const rows: string[] = [];
  if (Platform.canFullscreen) rows.push('<div class="mm-toggle" data-key="fullscreen" role="switch" tabindex="-1"><span>Fullscreen</span><b></b></div>');
  return rows.length ? `<h4 class="mm-h4 mm-h4-first">Display</h4>${rows.join('')}<h4 class="mm-h4">Sound &amp; camera</h4>` : '';
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
  return displayHTML() + SLIDERS.map((s) => `
    <label class="mm-slider" data-key="${s.key}"><span>${s.label}</span>
      <input type="range" min="${s.min}" max="${s.max}" step="${s.step}"><output></output></label>`).join('')
    + `<div class="mm-toggle" data-key="subtitles" role="switch" tabindex="-1"><span>Subtitles</span><b></b></div>
       <button class="mm-reset" type="button">Restore defaults</button><p class="mm-cloud-line"></p>`;
}

export function wireSettings(root: HTMLElement, settings: Settings, sound: (k: UiSound) => void, cloud?: CloudSave) {
  const paintPlatform = () => {
    const fs = root.querySelector<HTMLElement>('.mm-toggle[data-key="fullscreen"]');
    if (fs) { const on = Platform.isFullscreen(); fs.classList.toggle('on', on); fs.querySelector('b')!.textContent = on ? 'On' : 'Off'; }
    const line = root.querySelector<HTMLElement>('.mm-cloud-line');
    const w = cloudWords(cloud);
    if (line) { line.textContent = w ? w.text : ''; line.className = 'mm-cloud-line' + (w ? ' ' + w.cls : ''); }
  };
  root.querySelector('.mm-toggle[data-key="fullscreen"]')?.addEventListener('click', () => {
    sound('select');
    void Platform.setFullscreen(!Platform.isFullscreen()).then(() => setTimeout(paintPlatform, 120));
  });
  Platform.onChange(paintPlatform);
  cloud?.listenStatus(paintPlatform);
  const paint = () => {
    paintPlatform();
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

/** The Achievements panel (title + pause menu): the count, then each group — unlocked, locked, secret, progress. */
export function achievementsHTML(ach: Achievements) {
  const n = ach.count, total = ach.total;
  const C = 2 * Math.PI * 25;
  const date = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  let html = `<div class="ach-sum"><svg class="ach-ring" viewBox="0 0 58 58"><circle class="bg" cx="29" cy="29" r="25"/><circle class="fg" cx="29" cy="29" r="25"
      stroke-dasharray="${(C * n / total).toFixed(1)} ${C.toFixed(1)}"/><text x="29" y="30">${n}</text></svg>
    <div><b>${n} of ${total} deeds remembered</b><span>${n === total ? 'The castle has nothing left to show you.' : 'What the castle has seen you do.'}</span></div></div>`;
  for (const g of ACH_GROUPS) {
    const list = ACHIEVEMENTS.filter((a) => a.group === g.id);
    const got = list.filter((a) => ach.has(a.id)).length;
    html += `<h4 class="ach-group">${g.title} <small>${got} / ${list.length}</small></h4>`;
    for (const a of list) {
      const on = ach.has(a.id);
      const secret = !!a.hidden && !on;
      const veiled = secret && a.group === 'secret';
      const prog = ach.progress(a);
      const desc = secret ? (a.hint ?? 'A secret of the castle.') : a.desc;
      html += `<div class="ach-row${on ? ' on' : ''}${secret ? ' secret' : ''}">
        <div class="ach-medal">${iconSVG(veiled ? 'eye' : a.icon)}</div>
        <div class="ach-info"><b>${veiled ? 'A Secret' : a.name}</b><span>${desc}</span>
          ${prog && !on ? `<div class="ach-bar"><i style="width:${(100 * prog[0] / prog[1]).toFixed(1)}%"></i></div>` : ''}
          ${on ? `<em class="ach-when">Remembered ${date(ach.data.unlocked[a.id])}</em>` : ''}</div>
        <div class="ach-count">${prog ? `${prog[0]} / ${prog[1]}` : on ? '◆' : ''}</div>
      </div>`;
    }
  }
  html += `<button class="mm-reset ach-reset" type="button">Forget every deed</button>`;
  return html;
}

/** Fill an Achievements panel body (re-rendered on every open); the reset asks twice. Returns the re-render. */
export function wireAchievements(body: HTMLElement, ach: Achievements, sound: (k: UiSound) => void) {
  const render = () => {
    body.innerHTML = achievementsHTML(ach);
    const reset = body.querySelector<HTMLButtonElement>('.ach-reset')!;
    let armed = 0;
    reset.addEventListener('click', () => {
      if (!armed) {
        reset.classList.add('armed');
        reset.textContent = 'Press again to forget them all';
        sound('move');
        armed = window.setTimeout(() => { armed = 0; reset.classList.remove('armed'); reset.textContent = 'Forget every deed'; }, 3500);
        return;
      }
      clearTimeout(armed);
      ach.reset();
      sound('back');
      render();
    });
  };
  render();
  return render;
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
  private renderAch: () => void = () => {};
  private save: SaveData | null;

  constructor(stage: HTMLElement, private h: MenuHooks) {
    this.save = h.save;
    // Continue is always there (hidden without a save) so a cloud copy arriving under the title can bring it in
    const cont = `<button class="mm-item" data-act="continue" data-row="0" hidden><span>Continue</span><small></small></button>`;
    const r0 = 1;
    const p = h.player;
    const chip = p ? `<div class="mm-id">
        <span class="mm-id-av">${p.avatar ? `<img alt="" referrerpolicy="no-referrer" src="${encodeURI(p.avatar)}">` : ''}<b>${esc(p.name.slice(0, 1).toUpperCase())}</b></span>
        <span class="mm-id-text"><small>Playing as</small><b>${esc(p.name)}</b><i class="mm-id-cloud"><span class="mm-id-glyph">${CLOUD_GLYPH}</span><em></em></i></span>
      </div>` : '';
    const root = this.root = document.createElement('div');
    root.id = 'menu';
    root.className = 'mm hidden';
    root.innerHTML = `
      <div class="mm-shade"></div>
      <div class="mm-col">
      <div class="mm-head">
        <div class="mm-crest">${sigilSVG('mm')}</div>
        <h1 class="mm-title" aria-label="Echoes of Caer Veyr">
          <span class="mm-t-over" aria-hidden="true"><i></i><b>Echoes of</b><i></i></span>
          <span class="mm-t-main" aria-hidden="true"><em>C</em>aer <em>V</em>eyr<span class="mm-t-shine"><em>C</em>aer <em>V</em>eyr</span></span>
        </h1>
        <div class="mm-rule"><i></i><b>◆</b><i></i></div>
        <div class="mm-tag">The castle remembers · a keep torn between two memories</div>
      </div>
      <nav class="mm-list">
        ${cont}
        <button class="mm-item" data-act="new" data-row="${r0}"><span>New Game</span></button>
        <div class="mm-pair">
          <button class="mm-item mm-sec" data-act="lore" data-row="${r0 + 1}" data-col="0">${iconSVG('book', 'mm-dev')}<span>Lore</span></button>
          <button class="mm-item mm-sec" data-act="achievements" data-row="${r0 + 1}" data-col="1">${iconSVG('crown', 'mm-dev')}<span>Achievements</span><small class="mm-tally"></small></button>
        </div>
        <div class="mm-minor">
          <button class="mm-item mm-min" data-act="controls" data-row="${r0 + 2}" data-col="0"><span>Controls</span></button><i>◆</i>
          <button class="mm-item mm-min" data-act="settings" data-row="${r0 + 2}" data-col="1"><span>Settings</span></button><i>◆</i>
          <button class="mm-item mm-min" data-act="credits" data-row="${r0 + 2}" data-col="2"><span>Credits</span></button>
        </div>
      </nav>
      </div>
      <div class="mm-foot"><span class="mm-keys">↑ ↓ ← → choose · Enter confirm · Esc back</span></div>
      ${chip}
      ${this.panelHTML('guidance', 'New game', `
        <p class="mm-lead">How much should the castle teach you?</p>
        <p class="mm-replace" hidden></p>
        <div class="mm-choices">
          <button class="mm-choice on" data-guide="guided"><b>Guided</b><span>The castle teaches each skill in turn — moving, the sword, guard and parry, the Blood Sigils, Resonance, the time shift, crouching — pausing to let you try each one.</span></button>
          <button class="mm-choice" data-guide="minimal"><b>Minimal guidance</b><span>For those who know a blade. Objectives, the way forward and how the castle's two memories work — no combat lessons.</span></button>
        </div>
        <button class="mm-begin" type="button">Enter the keep</button>`)}
      ${this.panelHTML('controls', 'Controls', controlsHTML(Platform.isTouch))}
      ${this.panelHTML('settings', 'Settings', settingsHTML())}
      ${this.panelHTML('credits', 'Credits', creditsHTML())}
      ${this.panelHTML('achievements', 'Achievements', '')}`;
    stage.appendChild(root);
    this.list = root.querySelector('.mm-list')!;
    root.querySelectorAll<HTMLElement>('.mm-panel').forEach((p) => this.panels.set(p.dataset.panel!, p));
    wireTabs(this.panels.get('controls')!);
    wireSettings(this.panels.get('settings')!, h.settings, h.sound, h.cloud);
    // the avatar: Wavedash's CDN picture, or the initial when it cannot be shown (cross-origin rules, no picture)
    const img = root.querySelector<HTMLImageElement>('.mm-id-av img');
    if (img) {
      img.addEventListener('load', () => root.querySelector('.mm-id-av')!.classList.add('pic'));
      img.addEventListener('error', () => img.remove());
    }
    h.cloud?.listenStatus(() => this.paintCloud());
    this.paintCloud();
    this.setSave(h.save);
    // the first thing offered: Continue when there is a journey to continue, else New Game
    this.focusIdx = 0;
    this.paintFocus();
    this.renderAch = wireAchievements(this.panels.get('achievements')!.querySelector('.mm-body') as HTMLElement, h.achievements, h.sound);
    this.tally();
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

  private items() { return [...this.list.querySelectorAll<HTMLButtonElement>('.mm-item')].filter((b) => !b.hidden); }

  /** Continue's save (null hides it) — at build, and whenever a newer cloud copy is adopted under the title */
  setSave(s: SaveData | null) {
    this.save = s;
    const b = this.list.querySelector<HTMLButtonElement>('[data-act="continue"]')!;
    const was = this.items()[this.focusIdx];
    b.hidden = !s;
    if (s) { const l = saveLabel(s); b.querySelector('small')!.textContent = `${l.floor} · ${l.where}`; }
    // New Game says what it replaces (at the first Blood Sigil of the new journey)
    const note = this.root.querySelector<HTMLElement>('.mm-replace');
    if (note) {
      note.hidden = !s;
      if (s) note.textContent = `Your saved journey — ${saveLabel(s).floor} — is replaced when the new one reaches its first Blood Sigil.`;
    }
    const items = this.items();
    this.focusIdx = Math.max(0, was ? items.indexOf(was) : 0);
    if (!was || this.focusIdx < 0) this.focusIdx = 0;
    this.paintFocus();
  }

  private paintCloud() {
    const el = this.root.querySelector<HTMLElement>('.mm-id-cloud');
    if (!el) return;
    const w = cloudWords(this.h.cloud);
    el.hidden = !w;
    if (!w) return;
    el.className = 'mm-id-cloud ' + w.cls;
    el.querySelector('em')!.textContent = w.text;
  }

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
    if (act === 'continue') { if (!this.save) return; this.h.sound('select'); this.h.onContinue(this.save); return; }
    if (act === 'new') { this.openPanel('guidance'); return; }
    if (act === 'lore') { this.h.sound('select'); this.h.onLore(); return; }
    if (act === 'achievements') this.renderAch();
    this.openPanel(act);
  }

  /** the Achievements entry's small tally (3 / 26): when the title shows and when an unlock lands */
  tally() {
    const t = this.root.querySelector('.mm-tally');
    if (t) t.textContent = `${this.h.achievements.count} / ${this.h.achievements.total}`;
    if (this.panel === 'achievements') this.renderAch();
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
    if (!this.open || document.documentElement.classList.contains('intro-on') || document.documentElement.classList.contains('lore-on')) return;
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
    // rows (↑/↓) and places along a row (←/→): the pair and the quiet row are rows of two and three; a hidden
    // Continue is not a row
    const items = this.items();
    const cur = items[this.focusIdx];
    const row = Number(cur.dataset.row ?? 0), col = Number(cur.dataset.col ?? 0);
    const rowList = [...new Set(items.map((b) => Number(b.dataset.row ?? 0)))].sort((a, b) => a - b);
    const ri = rowList.indexOf(row), n = rowList.length;
    const at = (r: number, c: number) => {
      const inRow = items.filter((b) => Number(b.dataset.row ?? 0) === r);
      return items.indexOf(inRow[Math.min(c, inRow.length - 1)]);
    };
    let next = this.focusIdx;
    if (k === 'ArrowUp' || k === 'KeyW') next = at(rowList[(ri + n - 1) % n], col);
    else if (k === 'ArrowDown' || k === 'KeyS') next = at(rowList[(ri + 1) % n], col);
    else if (k === 'ArrowLeft' || k === 'KeyA') next = at(row, Math.max(0, col - 1));
    else if (k === 'ArrowRight' || k === 'KeyD') next = at(row, col + 1);
    else if (k === 'Enter' || k === 'NumpadEnter' || k === 'Space') { this.activate(cur.dataset.act!); return; }
    if (next !== this.focusIdx && next >= 0) { this.focusIdx = next; this.paintFocus(); this.h.sound('move'); }
  };
}

// ------------------------------------------------------------------ in play: the pause menu
export class PauseMenu {
  root: HTMLDivElement;
  private panel: string | null = null;
  onResume?: () => void;
  onQuit?: () => void;

  private renderAch: () => void;
  constructor(host: HTMLElement, settings: Settings, private sound: (k: UiSound) => void, achievements: Achievements, cloud?: CloudSave) {
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
          <button class="mm-item" data-act="achievements"><span>Achievements</span></button>
          <button class="mm-item" data-act="quit"><span>Quit to title</span></button>
        </nav>
        <p class="pm-note">Progress is kept at each Blood Sigil and each floor${cloud?.enabled ? ' — and in your Wavedash cloud save' : ''}.</p>
      </div>
      <section class="mm-panel" data-panel="controls"><div class="mm-frame"><header><h2>Controls</h2><button class="mm-back" type="button">Back</button></header><div class="mm-body">${controlsHTML(Platform.isTouch)}</div></div></section>
      <section class="mm-panel" data-panel="settings"><div class="mm-frame"><header><h2>Settings</h2><button class="mm-back" type="button">Back</button></header><div class="mm-body">${settingsHTML()}</div></div></section>
      <section class="mm-panel" data-panel="achievements"><div class="mm-frame"><header><h2>Achievements</h2><button class="mm-back" type="button">Back</button></header><div class="mm-body"></div></div></section>`;
    host.appendChild(root);
    wireTabs(root.querySelector('[data-panel="controls"]') as HTMLElement);
    wireSettings(root.querySelector('[data-panel="settings"]') as HTMLElement, settings, sound, cloud);
    this.renderAch = wireAchievements(root.querySelector('[data-panel="achievements"] .mm-body') as HTMLElement, achievements, sound);
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
    if (a === 'quit') {
      this.sound('back');
      // the save and its upload take a moment: say so on the button
      const q = this.root.querySelector('[data-act="quit"] span');
      if (q) q.textContent = 'Saving…';
      this.onQuit?.();
      return;
    }
    this.sound('select');
    if (a === 'achievements') this.renderAch();
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

/** text into HTML (a player's name comes from the platform) */
function esc(s: string) { return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)); }
