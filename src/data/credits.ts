/**
 * Credits (main menu → Credits). Every third-party asset that ships in the game, with its author and licence.
 * Sources: the GLBs' own `asset.extras` (Sketchfab), docs/CONTEXT.md §4 (Mixamo packs, textures) and
 * assets/audio/SOURCES.md (sound). CC BY 4.0 models REQUIRE this attribution — keep it complete when adding assets.
 */
export interface CreditLine { what: string; who: string; note?: string; url?: string }
export interface CreditSection {
  title: string; intro?: string; lines: CreditLine[];
  /** the opening block: the author, larger (MainMenu.creditsHTML) */
  byline?: string;
  /** a short statement set apart under the title (how the game was made) */
  statement?: string[];
}

/** The author's name as it appears in the game (credits, ending card). */
export const AUTHOR = 'AJ_Insanity';

export const CREDITS: CreditSection[] = [
  {
    title: 'Echoes of Caer Veyr',
    byline: AUTHOR,
    statement: [
      'Everything made for this game was created with <b>Claude Opus 5.5</b> and <b>Blender</b>: the code and every game system, '
        + 'the castle and its three floors, the props, the level and puzzle design, combat and enemy behaviour, the lighting, '
        + 'shaders and effects, the menus, the opening film and the tools that build it all.',
      'The only outside assets are 3D characters and creatures from <b>Sketchfab</b>, characters and animation from '
        + '<b>Adobe Mixamo</b>, and <b>textures</b> from Poly Haven — plus free CC0 sound-effect libraries. Each is credited below.',
      'The music is from <b>ElevenLabs</b>. The heroine’s voice, the dialogue and the narration are AI generated, '
        + 'as is everything else in the game.',
    ],
    lines: [
      { what: 'Created by', who: AUTHOR },
      { what: 'Built with', who: 'Claude Opus 5.5 (Anthropic) · Blender' },
      { what: 'Castle, props and floors', who: 'modelled in Blender by Claude Opus 5.5 for this game' },
      { what: 'Opening film', who: '“The Castle Remembers” — drawn in code with Remotion by Claude Opus 5.5', note: 'narration and score: ElevenLabs' },
      { what: 'Music', who: '“The Last Canopy Sleeps” (exploration, title) · “Savage Ritual” (combat)', note: 'generated with ElevenLabs' },
      { what: 'Voice & dialogue', who: 'the heroine and the narrator — AI generated with ElevenLabs', note: 'lines written with Claude Opus 5.5' },
    ],
  },
  {
    title: 'Characters & animation — Adobe Mixamo',
    intro: 'External asset: Adobe Mixamo characters and animations, used under the Mixamo terms of use.',
    lines: [
      { what: 'The Uncrowned', who: 'Mixamo “Maria” — Sword and Shield Pack, Great Sword Pack, Crouch Walking' },
      { what: 'Royal and Echo archers', who: 'Mixamo “Erika Archer” — Longbow Aiming Pack' },
      { what: 'The Last Crown', who: 'Mixamo “Nightshade” — Pro Magic Pack' },
      { what: 'The Maw of the Crownheart, the crown brutes', who: 'Mixamo “Mutant” and its animations' },
    ],
  },
  {
    title: '3D models — Sketchfab',
    intro: 'External assets from Sketchfab, licensed under Creative Commons Attribution 4.0 (CC BY 4.0) — creativecommons.org/licenses/by/4.0. '
      + 'Changes: rigged or retargeted to new animation, rescaled, materials adapted for the game.',
    lines: [
      { what: 'Royal guards, wardens, the Kingsguard', who: 'DM-913', note: '“Armored Guard Knight Rig”', url: 'https://sketchfab.com/3d-models/armored-guard-knight-rig-b7bba7eddb13470b88eb8b24531cb6b3' },
      { what: 'The Hollows', who: 'wojciechmiedziocha', note: '“zombie monster slasher necromorph”', url: 'https://sketchfab.com/3d-models/zombie-monster-slasher-necromorph-d2f9be4f379a410f8c88745921bde6a0' },
      { what: 'Echo Wraiths', who: 'RJproz', note: '“Night Monster”', url: 'https://sketchfab.com/3d-models/night-monster-e19073ac2fb44d39bfe86d5e281c666d' },
      { what: 'Gloom bats', who: 'Pablo.Sanagus', note: '“Bat Dark Bad Cartoon Monster”', url: 'https://sketchfab.com/3d-models/bat-dark-bad-cartoon-monster-5d09ed0a0315433d939067b57dcb44ab' },
      { what: 'The Widow, the Weeping Mother', who: 'Hobu', note: '“Ragno (Monster)”', url: 'https://sketchfab.com/3d-models/ragno-monster-2e1a422e6f0048f98a786ceecac423d7' },
      { what: 'Ruin goblins, the Gutter King', who: 'XialiMu.Bell', note: '“Gobelin_monster”', url: 'https://sketchfab.com/3d-models/gobelin-monster-f71b5e7f9cff48e8b470d921c15643f7' },
      { what: 'Glowing flowers', who: 'anyaachan', note: '“Low poly glowing flower”', url: 'https://sketchfab.com/3d-models/low-poly-glowing-flower-f8bc344271e341ccabfce466b608a120' },
      { what: 'Grass', who: 'Natural_Disbuster', note: '“Low Poly Grass”', url: 'https://sketchfab.com/3d-models/low-poly-grass-c7b3cadd101245d899ca49fa587b2745' },
      { what: 'Grass tufts', who: 'Anskar', note: '“Low Poly Grass Pack”', url: 'https://sketchfab.com/3d-models/low-poly-grass-pack-2ffb4d5302c14d038eaf6488b8c7ede2' },
    ],
  },
  {
    title: 'Textures — Poly Haven',
    intro: 'External asset: Poly Haven (polyhaven.com), CC0.',
    lines: [
      { what: 'Stone', who: 'stone wall 04 · japanese stone wall · marble 01 · dark rock 02 · rocky terrain 03' },
      { what: 'Wood', who: 'coated pine 02 · rough wood · wood planks dirt · moss wood · wood shutter' },
      { what: 'Metal and cloth', who: 'metal plate 02 · rust coarse 01 · rusty metal 04 · crepe satin · quatrefoil jacquard · rough linen' },
    ],
  },
  {
    title: 'Sound',
    intro: 'CC0 recordings (no attribution required — credited with thanks), processed for the game.',
    lines: [
      { what: 'Impact Sounds, RPG Audio', who: 'Kenney (kenney.nl)' },
      { what: 'Sword attacks and clashes', who: 'StarNinjas' },
      { what: 'Swishes', who: 'artisticdude' },
      { what: 'RPG, creature and SFX collections', who: 'rubberduck' },
      { what: 'Monster Sound Pack', who: 'Ogrebane' },
      { what: 'Ghost moans', who: 'qubodup (Iwan Gabovitch)' },
      { what: 'Dungeon ambience', who: 'JaggedStone' },
      { what: 'Wind loop', who: 'SketchMan3' },
      { what: 'Fireplace loop', who: 'PagDev' },
      { what: 'The heroine’s voice, the narration, gore / spell / film sound effects', who: 'AI generated with ElevenLabs' },
    ],
  },
  {
    title: 'Type & software',
    lines: [
      { what: 'EB Garamond', who: 'Georg Duffner, Octavio Pardo — SIL Open Font License 1.1' },
      { what: 'Cormorant Garamond', who: 'Christian Thalmann — SIL Open Font License 1.1' },
      { what: 'three.js', who: 'three.js authors — MIT' },
      { what: 'three-mesh-bvh', who: 'Garrett Johnson — MIT' },
      { what: 'Made with', who: 'Claude Opus 5.5 · Blender · Vite · Remotion · FFmpeg · Basis Universal' },
    ],
  },
];
