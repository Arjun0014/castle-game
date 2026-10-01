import type { CloudSave, CloudStatus } from '../platform/CloudSave';

/** the small seal: a sigil (saved here) and, on Wavedash, a cloud (stored online) */
export const CLOUD_GLYPH = '<svg class="si-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18.5h10.2a4.3 4.3 0 0 0 .5-8.6 5.8 5.8 0 0 0-11-.9A4.8 4.8 0 0 0 7 18.5Z"/><path class="si-mark" d="M9.3 13.6l2 2 3.8-4.2"/></svg>';
const SIGIL_GLYPH = '<svg class="si-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 12 12 21 5 12Z"/><path class="si-mark" d="M12 8.2 15 12 12 15.8 9 12Z"/></svg>';

/**
 * In play, a saved game says so — briefly and quietly (session 16): a small seal and one word at the edge of the frame
 * for a moment after each autosave (a Blood Sigil, a floor, a boss), never a banner. On Wavedash the seal becomes the
 * cloud once the upload lands ("Saved"), or stays the sigil with "Saved on this device" while the connection is away.
 * Small clears (an encounter cleared) save silently. Position: style in ui/platform.css (`.save-mark`).
 */
export class SaveIndicator {
  private el: HTMLElement;
  private timer = 0;
  private watching = false;

  constructor(host: HTMLElement, private cloud: CloudSave) {
    this.el = document.createElement('div');
    this.el.className = 'save-mark';
    this.el.innerHTML = `<span class="si-seal"></span><span class="si-text"></span>`;
    host.appendChild(this.el);
    cloud.listenStatus((s) => this.onCloud(s));
  }

  /** a local save was written */
  saved(why: string) {
    if (why === 'clear' || why === 'quit') return;
    this.watching = this.cloud.enabled;
    this.show(this.cloud.enabled ? 'saving' : 'local');
  }

  private onCloud(s: CloudStatus) {
    if (!this.watching) return;
    if (s === 'synced') { this.watching = false; this.show('cloud'); }
    else if (s === 'offline' || s === 'conflict') { this.watching = false; this.show('offline'); }
  }

  private show(kind: 'saving' | 'local' | 'cloud' | 'offline') {
    const el = this.el;
    (el.firstElementChild as HTMLElement).innerHTML = kind === 'cloud' ? CLOUD_GLYPH : SIGIL_GLYPH;
    (el.lastElementChild as HTMLElement).textContent = kind === 'saving' ? 'Saving' : kind === 'offline' ? 'Saved on this device' : 'Saved';
    el.className = `save-mark on ${kind}`;
    clearTimeout(this.timer);
    // a pending upload keeps the mark up a little longer; it hides on its own either way
    this.timer = window.setTimeout(() => el.classList.remove('on'), kind === 'saving' ? 6000 : 2400);
  }
}
