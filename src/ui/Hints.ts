import { Platform } from '../platform/Platform';

/**
 * Control hints depend on the input mode, not the view: level prompts authored with keyboard keys
 * (floor01_layout.py prompt ids) get touch wording when the touch HUD is active.
 */
const TOUCH_PROMPTS: Record<string, string> = {
  T_MOVE: 'Left thumb moves — push to the rim to sprint · drag anywhere else to look · JUMP to leap',
  T_COMBAT: 'ATTACK · HEAVY · hold GUARD (tap just before a hit = parry) · DODGE toward the stick · GUARD + HEAVY kicks',
  T_SHIFT: "The gate stands raised in the castle's memory. Hold SHIFT to shift — costs one resonance.",
  T_CROUCH: 'Walk into low gaps — you stoop through them on your own.',
  T_CRAWL: 'Keep moving to crawl beneath the fallen roof.',
};

export function promptText(id: string | undefined, text: string) {
  return (Platform.isTouch && id && TOUCH_PROMPTS[id]) || text;
}

export const Hints = {
  shiftUnlock: () => Platform.isTouch ? 'Hold SHIFT to force the castle between its memories' : 'Hold R to force the castle between its memories',
  combatTutorial: () => Platform.isTouch
    ? TOUCH_PROMPTS.T_COMBAT
    : 'LMB light · RMB heavy · hold Q guard (tap = parry) · Shift tap dodge · F kick · Q+RMB kick',
};
