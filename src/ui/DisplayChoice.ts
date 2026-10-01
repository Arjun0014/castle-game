import { Platform, type DisplayPref } from '../platform/Platform';
import { sigilSVG } from './LoadingScreen';
import type { UiSound } from './MainMenu';

/**
 * HOW WOULD YOU LIKE TO PLAY? (session 16) — asked once on a phone or tablet, before the title: PORTRAIT (the jam build's
 * upright layout) or LANDSCAPE (the widescreen game with the two-thumb touch layout). The choice is kept (local storage,
 * the cloud save) and Settings → Display changes it any time; the layout follows at once, no reload.
 *
 * It is drawn like the chapter card (the Crownheart sigil, the gilt rule, Cormorant capitals), over the whole window —
 * whichever way the device is held — and each option shows the layout itself: the stick under the left thumb, the seals
 * under the right. The LANDSCAPE tap is a user gesture: it asks for fullscreen (Wavedash's own request on Wavedash) and
 * for a landscape orientation lock; when a browser or the embedding page refuses, the rotate card asks instead.
 */
export function askDisplay(sound?: (k: UiSound) => void): Promise<DisplayPref> {
  return new Promise((resolve) => {
    Platform.choosing = true;
    Platform.layout();
    const el = document.createElement('div');
    el.id = 'display-choice';
    el.className = 'dc';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'How would you like to play?');
    const option = (p: DisplayPref, name: string, line: string) => `
      <button class="dc-opt" data-pref="${p}" type="button">
        <span class="dc-device ${p}" aria-hidden="true"><i class="dc-screen"><i class="dc-stick"></i><i class="dc-seals"><i></i><i></i><i></i></i></i></span>
        <b>${name}</b><span class="dc-line">${line}</span>
      </button>`;
    el.innerHTML = `
      <div class="dc-veil"></div>
      <div class="dc-card">
        <div class="dc-crest">${sigilSVG('dc')}</div>
        <h2 class="dc-title">How would you like to play?</h2>
        <div class="dc-rule"><i></i><b>◆</b><i></i></div>
        <div class="dc-options">
          ${option('portrait', 'Portrait', 'Held upright — the original layout.')}
          ${option('landscape', 'Landscape', 'Held sideways — the widescreen view, a thumb on each side.')}
        </div>
        <p class="dc-note">You can change this later in Settings → Display.</p>
      </div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    const opts = [...el.querySelectorAll<HTMLButtonElement>('.dc-opt')];
    let focus = -1;
    const paint = () => opts.forEach((b, i) => b.classList.toggle('focus', i === focus));
    const choose = (p: DisplayPref) => {
      if (!el.isConnected || el.classList.contains('out')) return;
      sound?.('select');
      Platform.choosing = false;
      Platform.setDisplayPref(p);
      // inside the tap: fullscreen + the orientation lock (both optional — refused, the rotate card covers it)
      if (p === 'landscape') void Platform.enterImmersive();
      el.classList.add('out');
      window.removeEventListener('keydown', onKey, true);
      setTimeout(() => el.remove(), 600);
      resolve(p);
    };
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowUp', 'KeyA', 'KeyW'].includes(e.code)) { focus = 0; paint(); sound?.('move'); }
      else if (['ArrowRight', 'ArrowDown', 'KeyD', 'KeyS'].includes(e.code)) { focus = 1; paint(); sound?.('move'); }
      else if ((e.code === 'Enter' || e.code === 'Space') && focus >= 0) choose(opts[focus].dataset.pref as DisplayPref);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    for (const b of opts) b.addEventListener('click', () => choose(b.dataset.pref as DisplayPref));
  });
}
