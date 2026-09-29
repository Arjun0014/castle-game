import type { TimeState } from '../levels/Materials';

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
      <div class="prompt"></div>
      <div class="interact"></div>
      <div class="message"></div>
      <div class="deny"></div>
      <div class="boss"><div class="boss-name"></div><div class="boss-track"><div class="boss-fill"></div></div></div>
      <div class="reticle"></div>
      <div class="flash"></div>
      <div class="fade"></div>
      <div class="debug"></div>
      <div class="pause"><h3>PAUSED</h3><p>Click to resume · \` toggles debug · F9 collision view</p></div>
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

  interact(text: string | null) {
    if (text) { this.interactEl.innerHTML = `<b>E</b>${text}`; this.interactEl.classList.add('on'); }
    else this.interactEl.classList.remove('on');
  }

  message(title: string, sub = '', seconds = 3.5) {
    this.messageEl.innerHTML = title + (sub ? `<small>${sub}</small>` : '');
    this.messageEl.classList.add('on');
    this.messageTimer = seconds;
  }

  deny(text: string) {
    this.denyEl.textContent = text;
    this.denyEl.classList.add('on');
    this.denyTimer = 2.4;
  }

  boss(name: string | null, f = 1) {
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
    if (this.promptTimer > 0 && (this.promptTimer -= dt) <= 0) this.promptEl.classList.remove('on');
    if (this.messageTimer > 0 && (this.messageTimer -= dt) <= 0) this.messageEl.classList.remove('on');
    if (this.denyTimer > 0 && (this.denyTimer -= dt) <= 0) this.denyEl.classList.remove('on');
  }
}
