import lore from '../data/loreManifest.json';
import type { AudioFX } from '../audio/Audio';
import type { Settings } from '../game/Settings';
import type { UiSound } from './MainMenu';
import './lore.css';

/**
 * The Chronicle of Caer Veyr (session 15): the twelve illustrated pages of the lore book, narrated.
 *
 * One reading space, two ways through it. AUTO: a page appears, its narration plays, a short beat after it ends the
 * next page turns in and its narration begins — through all twelve. MANUAL: swipe (touch or mouse drag), the arrows,
 * the keys or the page dots change the page at any time: the old narration fades out at once (never two at a time),
 * the new page's narration starts from its beginning (going back replays it) and the auto-advance timing starts over.
 * Pause / resume, subtitles on / off (the game's Subtitles setting), the folio (04 / 12) and a way out.
 *
 * Music: the title score keeps playing (it is never restarted); each narration ducks it lightly (Music.duck 0.5) and
 * it rises back between pages. The narration plays on the voice bus (the Voice slider).
 *
 * Memory (phones): only the current page, the one before it and the next two are held — images decoded
 * (Image.decode, 1024×1536 ≈ 6.3 MB each) and narration fetched; only the current and next narrations are decoded to
 * PCM. Pages leaving that window are released (src cleared, buffers dropped). The tiny blurred placeholder of every
 * page is inline in the manifest (shown at once, and as the ambient backdrop).
 *
 * Assets: public/assets/lore/page_NN.webp + narration_NN.ogg, src/data/loreManifest.json (tools/lore/build_lore.py).
 */
type Page = (typeof lore.pages)[number];
const PAGES: Page[] = lore.pages;
const N = PAGES.length;
const TURN_MS = 460;
/** the beat after a page's narration before the next page turns (auto) */
const AUTO_BEAT = 1.7;
/** the narration of a page starts this long after it has turned in */
const START_DELAY = 0.35;
const DUCK = 0.5;

export interface LoreHooks {
  audio: AudioFX;
  settings: Settings;
  sound(k: UiSound): void;
  onPage?(n: number): void;
  onOpen?(): void;
  onClose?(): void;
}

const pad = (n: number) => String(n).padStart(2, '0');

export class LoreBook {
  root: HTMLElement | null = null;
  isOpen = false;
  page = 1;
  paused = false;
  ended = false;
  /** a log of what the reader did (tests): page changes with how, narration starts / ends */
  log: { t: number; what: string }[] = [];

  private figs: HTMLElement[] = [];
  private stageEl!: HTMLElement;
  private imgs = new Map<number, { img: HTMLImageElement; ready: Promise<boolean> }>();
  private bytes = new Map<number, Promise<ArrayBuffer>>();
  private pcm = new Map<number, Promise<AudioBuffer | null>>();
  private src: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private token = 0;
  private startedAt = 0;
  private offset = 0;
  /** narration clock without audio (no context / a decode failed): performance.now based */
  private fallback: { t0: number; timer: number } | null = null;
  private narrating = 0;
  private advanceTimer = 0;
  private startTimer = 0;
  private tick = 0;
  private pendingTurn: (() => void) | null = null;
  private turnTimer = 0;
  private W = 0;
  private cueIdx = -1;

  constructor(private stage: HTMLElement, private h: LoreHooks) {}

  private note(what: string) {
    this.log.push({ t: +(performance.now() / 1000).toFixed(2), what });
    if (this.log.length > 120) this.log.shift();
  }

  // ------------------------------------------------------------------ building
  private build() {
    const root = this.root = document.createElement('section');
    root.className = 'lb';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'The Chronicle of Caer Veyr');
    root.innerHTML = `
      <div class="lb-amb"><img alt="" aria-hidden="true"><img alt="" aria-hidden="true"></div>
      <div class="lb-veil"></div>
      <header class="lb-head">
        <button class="lb-btn lb-close" type="button" aria-label="Close the chronicle"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
        <div class="lb-title"><small>The Chronicle of Caer Veyr</small><b></b></div>
        <div class="lb-folio" aria-live="polite"><b>01</b><i>/</i><span>${pad(N)}</span></div>
      </header>
      <div class="lb-stage">
        <div class="lb-track">${[0, 1, 2].map(() => '<figure class="lb-page"><div class="lb-frame"><img class="lb-ph" alt="" aria-hidden="true"><div class="lb-shade"></div></div></figure>').join('')}</div>
        <button class="lb-nav prev" type="button" aria-label="Previous page"><svg viewBox="0 0 24 24"><path d="M15 4 7 12l8 8"/></svg></button>
        <button class="lb-nav next" type="button" aria-label="Next page"><svg viewBox="0 0 24 24"><path d="m9 4 8 8-8 8"/></svg></button>
      </div>
      <div class="lb-sub"><p class="lb-line"></p><div class="lb-end"><p>Here the chronicle of Caer Veyr ends.</p>
        <div><button class="lb-textbtn lb-again" type="button">From the beginning</button><button class="lb-textbtn lb-leave" type="button">Return</button></div></div></div>
      <footer class="lb-bar">
        <button class="lb-btn lb-play" type="button" aria-label="Pause the narration"><svg class="i-pause" viewBox="0 0 24 24"><path d="M8.5 5v14M15.5 5v14"/></svg><svg class="i-play" viewBox="0 0 24 24"><path d="M8 5.5v13l10-6.5Z"/></svg><svg class="i-again" viewBox="0 0 24 24"><path d="M5 12a7 7 0 1 0 2.1-5M5 4.5V8h3.5"/></svg></button>
        <div class="lb-dots">${PAGES.map((p) => `<button class="lb-dot" type="button" aria-label="Page ${p.n}: ${p.title}"></button>`).join('')}<i class="lb-prog"><b></b></i></div>
        <button class="lb-btn lb-cc" type="button" aria-label="Subtitles"><span>CC</span></button>
      </footer>`;
    this.stage.appendChild(root);
    this.stageEl = root.querySelector('.lb-stage')!;
    this.figs = [...root.querySelectorAll<HTMLElement>('.lb-page')];
    root.querySelector('.lb-close')!.addEventListener('click', () => this.close());
    root.querySelector('.lb-leave')!.addEventListener('click', () => this.close());
    root.querySelector('.lb-again')!.addEventListener('click', () => { this.h.sound('select'); this.go(1, 'again'); });
    root.querySelector('.prev')!.addEventListener('click', () => this.go(this.page - 1, 'arrow'));
    root.querySelector('.next')!.addEventListener('click', () => this.go(this.page + 1, 'arrow'));
    root.querySelector('.lb-play')!.addEventListener('click', () => this.togglePause());
    root.querySelector('.lb-cc')!.addEventListener('click', () => this.toggleSubs());
    root.querySelectorAll<HTMLButtonElement>('.lb-dot').forEach((d, i) => d.addEventListener('click', () => this.go(i + 1, 'dot')));
    this.wireSwipe();
    new ResizeObserver(() => this.fit()).observe(this.stageEl);
  }

  /** the page frame: the largest 2:3 rectangle that fits the stage area (portrait: the width; wide: the height) */
  private fit() {
    const r = this.stageEl.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const p = PAGES[0];
    const ar = p.width / p.height;
    const w = Math.min(r.width, r.height * ar), hgt = w / ar;
    this.root!.style.setProperty('--pw', `${Math.floor(w)}px`);
    this.root!.style.setProperty('--ph', `${Math.floor(hgt)}px`);
    this.W = r.width;
    this.layout(0, false);
  }

  // ------------------------------------------------------------------ open / close
  open(start = 1) {
    if (this.isOpen) return;
    if (!this.root) this.build();
    const root = this.root!;
    this.isOpen = true;
    this.ended = false;
    this.paused = false;
    this.page = Math.min(N, Math.max(1, start));
    document.documentElement.classList.add('lore-on');
    root.classList.remove('out', 'ended', 'paused', 'clean');
    root.classList.toggle('subs-off', !this.h.settings.data.subtitles);
    root.style.display = '';
    this.assignFigs();
    this.window();
    this.paint();
    this.fit();
    window.addEventListener('keydown', this.onKey, true);
    this.tick = window.setInterval(() => this.update(), 50);
    setTimeout(() => root.classList.add('in'), 20);
    this.h.onOpen?.();
    this.h.onPage?.(this.page);
    this.note(`open p${this.page}`);
    this.scheduleStart(0.9);
  }

  close() {
    if (!this.isOpen) return;
    this.h.sound('back');
    this.isOpen = false;
    this.stopNarration(0.3);
    clearTimeout(this.advanceTimer);
    clearTimeout(this.startTimer);
    clearInterval(this.tick);
    window.removeEventListener('keydown', this.onKey, true);
    document.documentElement.classList.remove('lore-on');
    const root = this.root!;
    root.classList.remove('in');
    root.classList.add('out');
    this.note('close');
    setTimeout(() => {
      if (this.isOpen) return;
      root.style.display = 'none';
      // nothing of the book stays decoded behind the title
      for (const n of [...this.imgs.keys()]) this.evictImage(n);
      this.bytes.clear();
      this.pcm.clear();
    }, 520);
    this.h.onClose?.();
  }

  // ------------------------------------------------------------------ pages
  /** load the reading window (current, previous, next two), release the rest */
  private window() {
    const keep = [this.page - 1, this.page, this.page + 1, this.page + 2].filter((n) => n >= 1 && n <= N);
    for (const n of keep) { this.image(n); this.narrationBytes(n); }
    for (const n of [...this.imgs.keys()]) if (!keep.includes(n)) this.evictImage(n);
    for (const n of [...this.bytes.keys()]) if (!keep.includes(n)) this.bytes.delete(n);
    for (const n of [...this.pcm.keys()]) if (n !== this.page && n !== this.page + 1) this.pcm.delete(n);
    // decode the current and the next narration ahead of need
    this.buffer(this.page);
    if (this.page < N) this.buffer(this.page + 1);
  }

  private image(n: number) {
    let e = this.imgs.get(n);
    if (!e) {
      const img = new Image();
      img.decoding = 'async';
      img.alt = PAGES[n - 1].title;
      img.className = 'lb-img';
      img.draggable = false;
      img.src = PAGES[n - 1].image;
      const ready = img.decode().then(() => true, () => false);
      e = { img, ready };
      this.imgs.set(n, e);
      ready.then((ok) => { if (ok) img.classList.add('ready'); });
    }
    return e;
  }

  private evictImage(n: number) {
    const e = this.imgs.get(n);
    if (!e) return;
    e.img.remove();
    e.img.removeAttribute('src');
    this.imgs.delete(n);
  }

  /** the three figures show pages page-1, page, page+1 at slots -1, 0, +1 */
  private assignFigs() {
    this.figs.forEach((f, i) => {
      const n = this.page + (i - 1);
      f.dataset.slot = String(i - 1);
      this.fill(f, n);
    });
  }

  private fill(f: HTMLElement, n: number) {
    const frame = f.querySelector('.lb-frame') as HTMLElement;
    const ph = frame.querySelector('.lb-ph') as HTMLImageElement;
    frame.querySelectorAll('.lb-img').forEach((x) => x.remove());
    f.dataset.page = String(n);
    if (n < 1 || n > N) { f.classList.add('void'); ph.removeAttribute('src'); return; }
    f.classList.remove('void');
    ph.src = PAGES[n - 1].placeholder;
    frame.insertBefore(this.image(n).img, frame.querySelector('.lb-shade'));
  }

  /** place the figures: `dx` = the drag offset (px); anim = with the turn easing */
  private layout(dx: number, anim: boolean) {
    const gap = Math.max(18, this.W * 0.06);
    for (const f of this.figs) {
      const slot = Number(f.dataset.slot);
      const x = slot * (this.W + gap) + dx;
      const k = Math.min(1, Math.abs(x) / (this.W + gap));
      f.style.transition = anim ? `transform ${TURN_MS}ms cubic-bezier(0.22,0.72,0.2,1), opacity ${TURN_MS}ms ease` : 'none';
      f.style.transform = `translate3d(${x}px,0,0) scale(${1 - 0.06 * k})`;
      f.style.opacity = String(1 - 0.55 * k);
      (f.querySelector('.lb-shade') as HTMLElement).style.opacity = String(0.7 * k);
    }
  }

  /** header, folio, dots, ambient backdrop, arrows */
  private paint() {
    const r = this.root!;
    const p = PAGES[this.page - 1];
    (r.querySelector('.lb-title b') as HTMLElement).textContent = p.title;
    (r.querySelector('.lb-folio b') as HTMLElement).textContent = pad(this.page);
    r.querySelectorAll('.lb-dot').forEach((d, i) => { d.classList.toggle('on', i + 1 === this.page); d.classList.toggle('seen', i + 1 < this.page); });
    r.querySelector('.prev')!.classList.toggle('off', this.page <= 1);
    r.querySelector('.next')!.classList.toggle('off', this.page >= N);
    const amb = r.querySelectorAll<HTMLImageElement>('.lb-amb img');
    const front = amb[0].classList.contains('on') ? amb[1] : amb[0];
    const back = front === amb[0] ? amb[1] : amb[0];
    front.src = p.placeholder;
    front.classList.add('on');
    back.classList.remove('on');
    this.setLine('');
    this.cueIdx = -1;
  }

  /**
   * Change page. how: 'auto' (after the narration), 'swipe' / 'arrow' / 'key' / 'dot' / 'wheel' (the reader),
   * 'again' (from the beginning). A manual change stops the narration at once and plays the new page's from its start.
   */
  go(n: number, how = 'key') {
    if (!this.isOpen || n < 1 || n > N) { if (this.isOpen && how === 'swipe') this.layout(0, true); return false; }
    if (n === this.page && how !== 'again') { this.layout(0, true); return false; }
    // a turn still sliding (a fast second key) lands at once before the next one starts
    this.pendingTurn?.();
    const dir = n > this.page ? 1 : -1;
    const far = Math.abs(n - this.page) > 1;
    this.stopNarration(0.22);
    clearTimeout(this.advanceTimer);
    clearTimeout(this.startTimer);
    this.paused = false;
    this.ended = false;
    this.root!.classList.remove('paused', 'ended');
    if (how !== 'auto') this.h.sound('move');
    this.note(`p${this.page}->p${n} ${how}`);
    const from = this.page;
    this.page = n;
    if (far || how === 'again') {
      // a jump (dots, from the beginning): the target fades in where the current page was
      const cur = this.figs.find((f) => f.dataset.slot === '0')!;
      this.fill(cur, n);
      this.figs.forEach((f) => { if (f !== cur) this.fill(f, n + Number(f.dataset.slot)); });
      cur.animate([{ opacity: 0.2, transform: 'scale(0.97)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'ease-out' });
      this.layout(0, false);
    } else {
      // the turn: every figure slides one slot; the one leaving at the far side wraps round with the page after next
      for (const f of this.figs) f.dataset.slot = String(Number(f.dataset.slot) - dir);
      const wrap = this.figs.find((f) => Math.abs(Number(f.dataset.slot)) > 1)!;
      this.layout(0, true);
      const finish = () => {
        if (this.pendingTurn !== finish) return;
        this.pendingTurn = null;
        clearTimeout(this.turnTimer);
        wrap.dataset.slot = String(dir);
        this.fill(wrap, n + dir);
        this.layout(0, false);
      };
      this.pendingTurn = finish;
      this.turnTimer = window.setTimeout(finish, TURN_MS + 20);
    }
    this.window();
    this.paint();
    void from;
    this.h.onPage?.(n);
    this.scheduleStart((far ? 0.4 : TURN_MS / 1000) + START_DELAY);
    return true;
  }

  // ------------------------------------------------------------------ narration
  private narrationBytes(n: number) {
    let b = this.bytes.get(n);
    if (!b) {
      b = fetch(PAGES[n - 1].audio).then((r) => { if (!r.ok) throw new Error(`${r.status} ${PAGES[n - 1].audio}`); return r.arrayBuffer(); });
      b.catch(() => this.bytes.delete(n));
      this.bytes.set(n, b);
    }
    return b;
  }

  private buffer(n: number) {
    let p = this.pcm.get(n);
    if (!p) {
      const ctx = this.h.audio.ctx;
      p = ctx ? this.narrationBytes(n).then((b) => ctx.decodeAudioData(b.slice(0))).catch((err) => { console.warn('[lore] narration', n, err); return null; }) : Promise.resolve(null);
      this.pcm.set(n, p);
    }
    return p;
  }

  private scheduleStart(delay: number) {
    clearTimeout(this.startTimer);
    this.startTimer = window.setTimeout(() => this.startNarration(this.page, 0), delay * 1000);
  }

  private async startNarration(n: number, from: number) {
    const tok = ++this.token;
    this.root!.classList.add('waiting');
    const buf = await this.buffer(n);
    if (tok !== this.token || !this.isOpen || this.page !== n || this.paused) return;
    this.root!.classList.remove('waiting');
    const a = this.h.audio;
    const ctx = a.ctx;
    const out = a.voiceOut();
    this.offset = from;
    this.narrating = n;
    this.cueIdx = -1;
    a.music?.duck(true, DUCK, 1.2);
    if (buf && ctx && out && ctx.state === 'running') {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.06);
      src.connect(g).connect(out);
      this.startedAt = ctx.currentTime - from;
      src.start(ctx.currentTime, from);
      src.onended = () => { if (tok === this.token) this.narrationEnded(n); };
      this.src = src; this.gain = g;
      this.note(`narrate p${n} from ${from.toFixed(1)}`);
    } else {
      // no sound possible (no context, locked, a failed decode): the page still keeps time for subtitles and auto
      const dur = PAGES[n - 1].duration;
      const t0 = performance.now() - from * 1000;
      this.fallback = { t0, timer: window.setTimeout(() => { if (tok === this.token) this.narrationEnded(n); }, Math.max(0, dur - from) * 1000) };
      this.note(`narrate p${n} (silent clock) from ${from.toFixed(1)}`);
    }
  }

  /** narration time (s) on the current page */
  get time() {
    if (!this.narrating) return this.offset;
    if (this.src && this.h.audio.ctx) return this.h.audio.ctx.currentTime - this.startedAt;
    if (this.fallback) return (performance.now() - this.fallback.t0) / 1000;
    return this.offset;
  }

  private stopNarration(fade: number) {
    this.token++;
    const ctx = this.h.audio.ctx;
    if (this.src && this.gain && ctx) {
      const t = ctx.currentTime;
      this.gain.gain.cancelScheduledValues(t);
      this.gain.gain.setValueAtTime(this.gain.gain.value, t);
      this.gain.gain.linearRampToValueAtTime(0, t + fade);
      try { this.src.stop(t + fade + 0.02); } catch { /* already stopped */ }
      this.src.onended = null;
      this.note(`stop p${this.narrating}`);
    }
    if (this.fallback) clearTimeout(this.fallback.timer);
    this.src = null; this.gain = null; this.fallback = null;
    this.narrating = 0;
    this.h.audio.music?.duck(false, DUCK, 1.2);
  }

  private narrationEnded(n: number) {
    this.note(`ended p${n}`);
    this.src = null; this.gain = null; this.fallback = null;
    this.offset = PAGES[n - 1].duration;
    this.narrating = 0;
    this.h.audio.music?.duck(false, DUCK, 1.2);
    this.setLine('');
    if (!this.isOpen || this.page !== n || this.paused) return;
    if (n >= N) {
      this.ended = true;
      this.root!.classList.add('ended');
      this.note('book ended');
      return;
    }
    clearTimeout(this.advanceTimer);
    this.advanceTimer = window.setTimeout(() => { if (this.isOpen && this.page === n && !this.paused) this.go(n + 1, 'auto'); }, AUTO_BEAT * 1000);
  }

  togglePause() {
    if (!this.isOpen) return;
    if (this.ended) { this.h.sound('select'); this.go(1, 'again'); return; }
    this.h.sound('select');
    if (!this.paused) {
      this.paused = true;
      const t = this.time;
      this.stopNarration(0.18);
      this.offset = t;
      clearTimeout(this.advanceTimer);
      clearTimeout(this.startTimer);
      this.root!.classList.add('paused');
      this.note(`pause p${this.page} at ${t.toFixed(1)}`);
    } else {
      this.paused = false;
      this.root!.classList.remove('paused');
      this.note(`resume p${this.page} at ${this.offset.toFixed(1)}`);
      // finished page: resuming moves on; otherwise the narration continues where it stopped
      if (this.offset >= PAGES[this.page - 1].duration - 0.05) this.narrationEnded(this.page);
      else void this.startNarration(this.page, this.offset);
    }
  }

  toggleSubs() {
    const on = !this.h.settings.data.subtitles;
    this.h.settings.set('subtitles', on);
    this.root!.classList.toggle('subs-off', !on);
    this.h.sound('move');
  }

  private setLine(text: string) {
    const el = this.root!.querySelector('.lb-line') as HTMLElement;
    if (el.dataset.text === text) return;
    el.dataset.text = text;
    el.classList.remove('on');
    if (!text) return;
    // fade the new line in (the old one has faded out with the class change)
    requestAnimationFrame(() => { el.textContent = text; el.classList.add('on'); });
    setTimeout(() => { if (el.dataset.text === text && !el.classList.contains('on')) { el.textContent = text; el.classList.add('on'); } }, 60);
  }

  /** 20 Hz: the subtitle cue and the page's progress hairline */
  private update() {
    if (!this.isOpen) return;
    const p = PAGES[this.page - 1];
    const t = this.time;
    const prog = this.narrating ? Math.min(1, t / p.duration) : this.ended || this.offset >= p.duration ? 1 : this.offset / p.duration;
    (this.root!.querySelector('.lb-prog b') as HTMLElement).style.transform = `scaleX(${prog.toFixed(4)})`;
    if (!this.narrating) return;
    let idx = -1;
    for (let i = 0; i < p.cues.length; i++) if (t >= p.cues[i].t0 - 0.12 && t <= p.cues[i].t1 + 0.55) { idx = i; break; }
    if (idx !== this.cueIdx) {
      this.cueIdx = idx;
      this.setLine(idx >= 0 ? p.cues[idx].text : '');
    }
  }

  // ------------------------------------------------------------------ input
  private onKey = (e: KeyboardEvent) => {
    if (!this.isOpen) return;
    const k = e.code;
    const map: Record<string, () => void> = {
      ArrowRight: () => this.go(this.page + 1, 'key'), KeyD: () => this.go(this.page + 1, 'key'), PageDown: () => this.go(this.page + 1, 'key'),
      ArrowLeft: () => this.go(this.page - 1, 'key'), KeyA: () => this.go(this.page - 1, 'key'), PageUp: () => this.go(this.page - 1, 'key'),
      Home: () => this.go(1, 'key'), End: () => this.go(N, 'key'),
      Space: () => this.togglePause(), KeyK: () => this.togglePause(), KeyP: () => this.togglePause(),
      KeyC: () => this.toggleSubs(), Escape: () => this.close(), Backspace: () => this.close(),
    };
    const fn = map[k];
    // every other key stays with the book too (the title screen behind it must not react)
    e.preventDefault();
    e.stopPropagation();
    if (fn && !e.repeat) fn();
  };

  private wheelAcc = 0;
  private wheelUntil = 0;
  private wireSwipe() {
    const el = this.stageEl;
    let d: { id: number; x0: number; y0: number; t0: number; dx: number; active: boolean; lastX: number; lastT: number; v: number } | null = null;
    el.addEventListener('pointerdown', (e) => {
      if (e.button > 0 || (e.target as HTMLElement).closest('.lb-nav')) return;
      // a quick second swipe: the page still sliding lands at once, the finger takes the next one
      this.pendingTurn?.();
      d = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(), dx: 0, active: false, lastX: e.clientX, lastT: performance.now(), v: 0 };
    });
    el.addEventListener('pointermove', (e) => {
      if (!d || e.pointerId !== d.id) return;
      const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
      if (!d.active) {
        if (Math.abs(dx) > 9 && Math.abs(dx) > Math.abs(dy) * 1.15) { d.active = true; el.setPointerCapture(e.pointerId); el.classList.add('dragging'); }
        else if (Math.abs(dy) > 24) { d = null; return; }
        else return;
      }
      const now = performance.now();
      d.v = (e.clientX - d.lastX) / Math.max(1, now - d.lastT) * 0.6 + d.v * 0.4;
      d.lastX = e.clientX; d.lastT = now;
      // resistance past the first and the last page
      const edge = (dx > 0 && this.page <= 1) || (dx < 0 && this.page >= N);
      d.dx = edge ? dx * 0.28 : dx;
      this.layout(d.dx, false);
    });
    const end = (e: PointerEvent) => {
      if (!d || e.pointerId !== d.id) return;
      const g = d;
      d = null;
      el.classList.remove('dragging');
      if (!g.active) {
        // a tap on the page (not a drag): the clean view — the artwork alone — or back
        if (e.type === 'pointerup' && performance.now() - g.t0 < 350 && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < 8) this.root!.classList.toggle('clean');
        return;
      }
      const W = this.W || 1;
      if (g.dx < -W * 0.16 || (g.v < -0.42 && g.dx < -12)) this.go(this.page + 1, 'swipe');
      else if (g.dx > W * 0.16 || (g.v > 0.42 && g.dx > 12)) this.go(this.page - 1, 'swipe');
      else this.layout(0, true);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    // trackpads / wheels: a horizontal (or vertical) flick turns one page
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const now = performance.now();
      if (now < this.wheelUntil) return;
      this.wheelAcc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(this.wheelAcc) > 70) {
        this.go(this.page + (this.wheelAcc > 0 ? 1 : -1), 'wheel');
        this.wheelAcc = 0;
        this.wheelUntil = now + 650;
      }
    }, { passive: false });
  }

  /** test / debug read-out */
  debug() {
    return {
      open: this.isOpen, page: this.page, paused: this.paused, ended: this.ended, narrating: this.narrating, time: +this.time.toFixed(2),
      line: this.root?.querySelector('.lb-line')?.textContent ?? '', images: [...this.imgs.keys()].sort((a, b) => a - b),
      decoded: [...this.imgs.entries()].filter(([, e]) => e.img.complete && e.img.naturalWidth > 0).map(([n]) => n).sort((a, b) => a - b),
      audioBytes: [...this.bytes.keys()].sort((a, b) => a - b), pcm: [...this.pcm.keys()].sort((a, b) => a - b),
      duck: this.h.audio.music?.duckLevel ?? null, log: this.log.slice(-12),
    };
  }
}
