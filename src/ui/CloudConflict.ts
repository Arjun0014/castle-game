import type { Conflict } from '../platform/CloudSave';
import { saveLabel, saveRank, type SaveData } from '../game/Save';
import type { UiSound } from './MainMenu';

/**
 * Two memories of one journey (session 16): the cloud save and this device's save disagree in a way no rule can settle
 * (the newer copy is behind the older one — platform/CloudSave.ts). The player chooses which to keep; the other is set
 * aside on this device, never destroyed before the choice. Drawn as one of the title's panels: two cards — CLOUD SAVE and
 * THIS DEVICE, each with its floor, its Blood Sigil and when it was saved — and the gold button.
 */
export function askConflict(stage: HTMLElement, c: Conflict, sound?: (k: UiSound) => void): Promise<void> {
  return new Promise((resolve) => {
    const when = (d: SaveData) => d.savedAt
      ? new Date(d.savedAt).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'an earlier version of the game';
    const card = (keep: 'cloud' | 'local', d: SaveData, name: string) => {
      const l = saveLabel(d);
      return `<button class="mm-choice cc-choice" data-keep="${keep}" type="button">
        <small>${name}</small><b>${l.floor}</b><span>${l.where}${d.deaths ? ` · ${d.deaths} ${d.deaths === 1 ? 'death' : 'deaths'}` : ''}</span><em>Saved ${when(d)}</em>
      </button>`;
    };
    const el = document.createElement('section');
    el.className = 'mm-panel on cc-panel';
    el.setAttribute('role', 'dialog');
    el.innerHTML = `
      <div class="mm-frame cc-frame"><header><h2>Two memories of your journey</h2></header>
        <div class="mm-body">
          <p class="mm-lead">Your cloud save and this device remember different journeys. Choose the one to keep — the other is set aside on this device, not erased.</p>
          <div class="mm-choices cc-choices">${card('cloud', c.cloud, 'Cloud save')}${card('local', c.local, 'This device')}</div>
          <button class="mm-begin cc-keep" type="button">Keep this journey</button>
        </div></div>`;
    stage.appendChild(el);
    document.documentElement.classList.add('cc-on');
    // the further journey is offered first
    let keep: 'cloud' | 'local' = saveRank(c.cloud) >= saveRank(c.local) ? 'cloud' : 'local';
    const choices = [...el.querySelectorAll<HTMLButtonElement>('.cc-choice')];
    const paint = () => choices.forEach((b) => b.classList.toggle('on', b.dataset.keep === keep));
    paint();
    const done = async () => {
      if (el.classList.contains('busy')) return;
      el.classList.add('busy');
      sound?.('select');
      window.removeEventListener('keydown', onKey, true);
      await c.resolve(keep);
      el.classList.remove('on');
      document.documentElement.classList.remove('cc-on');
      setTimeout(() => el.remove(), 400);
      resolve();
    };
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowUp', 'KeyA', 'KeyW'].includes(e.code)) { keep = 'cloud'; paint(); sound?.('move'); }
      else if (['ArrowRight', 'ArrowDown', 'KeyD', 'KeyS'].includes(e.code)) { keep = 'local'; paint(); sound?.('move'); }
      else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') void done();
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    for (const b of choices) {
      b.addEventListener('click', () => { keep = b.dataset.keep as 'cloud' | 'local'; paint(); sound?.('move'); });
      b.addEventListener('dblclick', () => void done());
    }
    el.querySelector('.cc-keep')!.addEventListener('click', () => void done());
  });
}
