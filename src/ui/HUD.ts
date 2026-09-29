import type { TimeState } from '../levels/Materials';
import { Platform } from '../platform/Platform';

/** One off-screen threat marker: stage-space angle from the centre, ranged/telegraphing flags. */
export interface Threat { x: number; y: number; ranged: boolean; hot: boolean }
const THREAT_MARKERS = 6;

/** Minimal HTML HUD: health, resonance (2 segments), state badge, channel bar, prompts, boss bar. */
export class HUD {
  root: HTMLElement;
  private hpFill: HTMLElement;
  private hpLag: HTMLElement;
  private segs: HTMLElement[] = [];
  private segFill: HTMLElement[] = [];
  private badge: HTMLElement;
  private channel: HTMLElement;
  private channelFill: HTMLElement;
  private channelText: HTMLElement;
  private promptEl: HTMLElement;
  private interactEl: HTMLElement;
  private messageEl: HTMLElement;
  private denyEl: HTMLElement;
  private bossEl: HTMLElement;
  private bossFill: HTMLElement;
  private bossName: HTMLElement;
  private flashEl: HTMLElement;
  private vignette: HTMLElement;
  private fadeEl: HTMLElement;
  debugEl: HTMLElement;
  pauseEl: HTMLElement;
  endEl: HTMLElement;
  reticle: HTMLElement;
  private threatEls: HTMLElement[] = [];
  /** touch HUD hook: contextual interact pill */
  onInteractText?: (text: string | null, title: string, disabled: boolean) => void;
  private promptTimer = 0;
  private messageTimer = 0;
  private denyTimer = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    root.innerHTML = `
      <div class="vignette"></div>
      <div class="state-badge present">PRESENT</div>
      <div class="hud-bars">
        <div class="hp-bar"><div class="hp-lag"></div><div class="hp-fill"></div></div>
        <div class="charge"><div class="charge-seg"><div class="charge-fill"></div></div><div class="charge-seg"><div class="charge-fill"></div></div></div>
        <div class="charge-label">RESONANCE</div>
      </div>
      <div class="channel"><div class="channel-track"><div class="channel-fill"></div></div><div class="channel-text">SHIFTING</div></div>
      <div class="objective"><i>◆</i><span></span></div>
      <div class="subtitle"><span></span></div>
      <div class="tutorial"><b></b><span></span><em></em></div>
      <div class="gift"><small>THE CASTLE ANSWERS YOUR BLOOD</small><b></b><span class="gift-key"></span></div>
      <div class="gift-tip"><b></b><span></span></div>
      <div class="prompt"></div>
      <div class="interact"></div>
      <div class="message"></div>
      <div class="deny"></div>
      <div class="boss"><div class="boss-name"></div><div class="boss-track"><div class="boss-fill"></div></div></div>
      <div class="reticle"></div>
      <div class="flash"></div>
      <div class="fade"></div>
      <div class="debug"></div>
      <div class="pause"></div>
      <div class="end-card"><h1>FLOOR I COMPLETE</h1><p class="end-sub"></p><p>The way to the Upper Keep lies open.</p></div>`;
    const q = (s: string) => root.querySelector(s) as HTMLElement;
    this.hpFill = q('.hp-fill');
    this.hpLag = q('.hp-lag');
    root.querySelectorAll('.charge-seg').forEach((s) => { this.segs.push(s as HTMLElement); this.segFill.push(s.querySelector('.charge-fill') as HTMLElement); });
    this.badge = q('.state-badge');
    this.channel = q('.channel');
    this.channelFill = q('.channel-fill');
    this.channelText = q('.channel-text');
    this.promptEl = q('.prompt');
    this.interactEl = q('.interact');
    this.messageEl = q('.message');
    this.denyEl = q('.deny');
    this.bossEl = q('.boss');
    this.bossFill = q('.boss-fill');
    this.bossName = q('.boss-name');
    this.flashEl = q('.flash');
    this.vignette = q('.vignette');
    this.fadeEl = q('.fade');
    this.debugEl = q('.debug');
    this.pauseEl = q('.pause');
    this.endEl = q('.end-card');
    this.reticle = q('.reticle');
    this.objectiveEl = q('.objective');
    this.subtitleEl = q('.subtitle');
    this.tutorialEl = q('.tutorial');
    this.giftEl = q('.gift');
    this.giftTipEl = q('.gift-tip');
    this.guideEl = document.createElement('div');
    this.guideEl.className = 'offscreen guide';
    root.appendChild(this.guideEl);
    for (let i = 0; i < THREAT_MARKERS; i++) {
      const el = document.createElement('div');
      el.className = 'offscreen';
      root.appendChild(el);
      this.threatEls.push(el);
    }
  }

  /**
   * Off-screen threat markers (portrait): each threat is a direction in stage space (x right, y down, from the
   * centre). The chevron sits on an inset ellipse at the stage edge, pointing outward toward the enemy.
   */
  setThreats(list: Threat[]) {
    const w = Platform.width, h = Platform.height;
    const rx = w * 0.5 - 22, ry = h * 0.5 - 30;
    for (let i = 0; i < this.threatEls.length; i++) {
      const el = this.threatEls[i];
      const t = list[i];
      if (!t) { if (el.classList.contains('on')) el.className = 'offscreen'; continue; }
      const ang = Math.atan2(t.y, t.x);
      const x = w * 0.5 + Math.cos(ang) * rx;
      const y = h * 0.5 + Math.sin(ang) * ry;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${(ang * 180 / Math.PI).toFixed(1)}deg)`;
      el.className = 'offscreen on' + (t.ranged ? ' ranged' : '') + (t.hot ? ' hot' : '');
    }
  }

  private giftEl!: HTMLElement;
  private giftTipEl!: HTMLElement;
  private giftTimer = 0;
  private giftTipKey = '';
  /**
   * A floor reward unlocked: a short gilded reveal (the move's name and its input), not a modal — play goes on.
   * The persistent how-to lives in abilityTip() until the move has been performed once.
   */
  abilityReveal(name: string, input: string, seconds = 4.4) {
    const el = this.giftEl;
    (el.children[1] as HTMLElement).textContent = name;
    (el.children[2] as HTMLElement).textContent = input;
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    this.giftTimer = seconds;
  }
  /** Compact persistent tip ("HOLD HEAVY — …") until the move is tried; null hides it. */
  abilityTip(input: string | null, text = '') {
    const key = input ? input + '|' + text : '';
    if (key === this.giftTipKey) return;
    this.giftTipKey = key;
    const el = this.giftTipEl;
    if (!input) { el.classList.remove('on'); return; }
    (el.children[0] as HTMLElement).textContent = input;
    (el.children[1] as HTMLElement).textContent = text;
    el.classList.add('on');
  }
  /** a cinematic finisher is playing: letterbox bars in, the transient HUD out */
  cinematic(on: boolean) { this.root.classList.toggle('cine', on); }

  private objectiveEl!: HTMLElement;
  private subtitleEl!: HTMLElement;
  private tutorialEl!: HTMLElement;
  private guideEl!: HTMLElement;
  private objectiveText: string | null = null;
  private tutorialKey = '';
  private noticeTimer = 0;
  private notice: { title: string; text: string; cue?: string } | null = null;
  private persist: { title: string; text: string; cue?: string } | null = null;

  /** The current objective (one short line, top-left). `fresh` = a new objective replaced the old one. */
  objective(text: string | null, fresh = false) {
    if (text === this.objectiveText) return;
    this.objectiveText = text;
    const el = this.objectiveEl;
    if (!text) { el.classList.remove('on'); return; }
    (el.lastElementChild as HTMLElement).textContent = text;
    el.classList.add('on');
    if (fresh) { el.classList.remove('fresh'); void el.offsetWidth; el.classList.add('fresh'); }
  }

  /**
   * Persistent tutorial card (set every frame by the objective system; null hides it). A timed notice
   * (see notice()) takes precedence while it runs.
   */
  tutorial(title: string | null, text = '', cue = '') {
    this.persist = title ? { title, text, cue } : null;
    this.renderTutorial();
  }
  /** Guided tutorial: the lesson was performed — the card flashes gold before the next one. */
  lessonDone() {
    const el = this.tutorialEl;
    el.classList.remove('done'); void el.offsetWidth; el.classList.add('done');
    setTimeout(() => el.classList.remove('done'), 800);
  }
  /** Guided tutorial: point at the Resonance bar (a gold pulse round it). */
  teachBar(on: boolean) { this.root.querySelector('.hud-bars')?.classList.toggle('teach', on); }
  /** Guided tutorial slow motion: the frame darkens at its edges. */
  setFreeze(on: boolean) { this.root.classList.toggle('freeze', on); }
  /** A one-off explanatory card for `seconds` (e.g. the first Resonance). */
  noticeCard(title: string, text: string, seconds = 7) {
    this.notice = { title, text };
    this.noticeTimer = seconds;
    this.renderTutorial();
  }
  private renderTutorial() {
    const c = this.notice ?? this.persist;
    const key = c ? c.title + '|' + c.text + '|' + (c.cue ?? '') : '';
    if (key === this.tutorialKey) return;
    this.tutorialKey = key;
    const el = this.tutorialEl;
    if (!c) { el.classList.remove('on'); return; }
    (el.children[0] as HTMLElement).textContent = c.title;
    (el.children[1] as HTMLElement).textContent = c.text;
    (el.children[2] as HTMLElement).textContent = c.cue ?? '';
    el.classList.toggle('cue', !!c.cue);
    el.classList.add('on');
  }

  /** Settings → Subtitles (the heroine's lines still play when off) */
  subtitlesOn = true;
  /** The heroine's line as a subtitle (null clears). */
  subtitle(text: string | null) {
    const el = this.subtitleEl;
    if (!text || !this.subtitlesOn) { el.classList.remove('on'); return; }
    (el.firstElementChild as HTMLElement).textContent = text;
    el.classList.add('on');
  }

  /** Gold objective chevron on the frame edge (direction like threats: x right, y down); null hides. */
  guide(dir: { x: number; y: number } | null) {
    const el = this.guideEl;
    if (!dir) { el.classList.remove('on'); return; }
    const w = Platform.width, h = Platform.height;
    const ang = Math.atan2(dir.y, dir.x);
    const x = w * 0.5 + Math.cos(ang) * (w * 0.5 - 26), y = h * 0.5 + Math.sin(ang) * (h * 0.5 - 34);
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${(ang * 180 / Math.PI).toFixed(1)}deg)`;
    el.classList.add('on');
  }

  setHealth(hp: number, max: number) {
    const f = Math.max(0, hp / max) * 100;
    this.hpFill.style.width = f + '%';
    this.hpLag.style.width = f + '%';
    const low = hp / max < 0.3;
    this.vignette.style.boxShadow = low ? 'inset 0 0 200px rgba(140,0,0,0.55)' : 'inset 0 0 180px rgba(0,0,0,0.35)';
  }

  setCharge(charge: number, perShift: number, state: TimeState) {
    const col = state === 'PAST' ? '#f0a54a' : '#7fc4ff';
    for (let i = 0; i < this.segs.length; i++) {
      const f = Math.max(0, Math.min(1, (charge - i * perShift) / perShift));
      this.segFill[i].style.width = f * 100 + '%';
      this.segFill[i].style.background = f >= 1 ? col : 'rgba(200,200,220,0.55)';
      this.segs[i].classList.toggle('full', f >= 1);
    }
  }

  setState(state: TimeState) {
    this.badge.textContent = state;
    this.badge.className = 'state-badge ' + state.toLowerCase();
  }

  setChannel(on: boolean, f = 0, text = 'SHIFTING') {
    this.channel.classList.toggle('on', on);
    this.channelFill.style.width = f * 100 + '%';
    this.channelText.textContent = text;
  }

  prompt(text: string, seconds = 5) {
    this.promptEl.textContent = text;
    this.promptEl.classList.add('on');
    this.promptTimer = seconds;
  }

  private interactKey = '';
  /**
   * Contextual interaction card: `title` names the thing (BLOOD SIGIL), `text` says what pressing does
   * (Activate Checkpoint). Keyboard shows the E key; the touch HUD mirrors it on its tappable pill.
   * `disabled` = visible but unavailable right now (e.g. a sigil recovering), shown greyed without a key.
   */
  interact(text: string | null, title = '', disabled = false) {
    const key = text ? `${title}|${text}|${disabled}` : '';
    if (key === this.interactKey) return;
    this.interactKey = key;
    if (text) {
      this.interactEl.innerHTML = (title ? `<i>${title}</i>` : '') + (disabled ? `<span>${text}</span>` : `<span><b>E</b>${text}</span>`);
      this.interactEl.classList.add('on');
      this.interactEl.classList.toggle('off', disabled);
    } else this.interactEl.classList.remove('on');
    this.onInteractText?.(text, title, disabled);
  }

  message(title: string, sub = '', seconds = 3.5) {
    this.messageEl.innerHTML = title + (sub ? `<small>${sub}</small>` : '');
    this.messageEl.classList.add('on');
    this.messageTimer = seconds;
  }

  deny(text: string, seconds = 2.4) {
    this.denyEl.textContent = text;
    this.denyEl.classList.add('on');
    this.denyTimer = seconds;
  }

  boss(name: string | null, f = 1) {
    this.root.classList.toggle('boss-on', !!name);
    if (!name) { this.bossEl.classList.remove('on'); return; }
    this.bossName.textContent = name;
    this.bossFill.style.width = Math.max(0, f) * 100 + '%';
    this.bossEl.classList.add('on');
  }

  flash(color = '#ffffff', strength = 0.8) {
    this.flashEl.style.transition = 'none';
    this.flashEl.style.background = color;
    this.flashEl.style.opacity = String(strength);
    requestAnimationFrame(() => { this.flashEl.style.transition = 'opacity .9s'; this.flashEl.style.opacity = '0'; });
  }

  fade(on: boolean) { this.fadeEl.style.opacity = on ? '1' : '0'; }

  update(dt: number) {
    if (this.noticeTimer > 0 && (this.noticeTimer -= dt) <= 0) { this.notice = null; this.renderTutorial(); }
    if (this.giftTimer > 0 && (this.giftTimer -= dt) <= 0) this.giftEl.classList.remove('on');
    if (this.promptTimer > 0 && (this.promptTimer -= dt) <= 0) this.promptEl.classList.remove('on');
    if (this.messageTimer > 0 && (this.messageTimer -= dt) <= 0) this.messageEl.classList.remove('on');
    if (this.denyTimer > 0 && (this.denyTimer -= dt) <= 0) this.denyEl.classList.remove('on');
  }
}
