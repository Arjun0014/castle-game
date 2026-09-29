import React from 'react';
import {Audio, Video} from '@remotion/media';
import {AbsoluteFill, Sequence, continueRender, delayRender, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {Embers, Grain, H, InkReveal, Motes, Rain, Vignette} from './fx';
import {Flash, InkClip, InkFigure, InkSpill, Parchment, PaintedPanel, RedInk, V1Clip} from './scenes';
import opening from './opening.json';

// Film clock: 24 fps, 66 s. Shot boundaries (frames) follow tools/cinematic/timeline.json, so every picture beat stays
// on the existing soundtrack (build/cinematic/audio/mix.wav): the drop on "blood", the portcullis on "sealed", etc.
export const FPS = 24;
export const DURATION = 1584;
const S = {
	S01: 0, S02: 166, S03: 331, FLASH: 379, S04: 487, S05: 542, S06: 627, S07: 672, S08: 751, S09: 811, S10: 1016, S11: 1142, S12: 1265, S13: 1320, S15: 1375, S17: 1488, END: 1584,
};
const DROP = 234; // the drop lands on "blood" (9.75 s)
const SLAM = 607; // the portcullis lands on "sealed" (25.29 s)

const font = new FontFace('EB Garamond', `url(${staticFile('fonts/eb-garamond-latin-500-normal.woff2')})`, {weight: '500'});
let fontLoaded = false;

const Subtitles: React.FC = () => {
	const [handle] = React.useState(() => (fontLoaded ? null : delayRender('font')));
	React.useEffect(() => {
		if (!handle) return;
		font.load().then(() => {
			document.fonts.add(font);
			fontLoaded = true;
			continueRender(handle);
		});
	}, [handle]);
	const f = useCurrentFrame();
	const t = f / FPS;
	const [fi, fo] = opening.subtitleFade as [number, number];
	const s = opening.subtitles.find((x) => t >= x.start - 0.01 && t <= x.end + 0.01);
	if (!s) return null;
	const paper = (s as {paper?: boolean}).paper === true;
	const a = Math.min(
		interpolate(t, [s.start, s.start + fi], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
		interpolate(t, [s.end - fo, s.end], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
	);
	return (
		<AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: H * 0.1}}>
			<div
				style={{
					opacity: a,
					maxWidth: 860,
					padding: '22px 56px',
					textAlign: 'center',
					fontFamily: 'EB Garamond, Georgia, serif',
					fontWeight: 500,
					fontSize: 46,
					lineHeight: 1.32,
					color: paper ? '#2a180c' : '#efe4cc',
					textWrap: 'balance',
					background: paper
						? 'radial-gradient(closest-side, rgba(246,238,220,0.7), rgba(246,238,220,0.35) 60%, rgba(246,238,220,0) 100%)'
						: 'radial-gradient(closest-side, rgba(0,0,0,0.5), rgba(0,0,0,0.3) 55%, rgba(0,0,0,0) 100%)',
					textShadow: paper
						? '0 0 12px rgba(250,244,230,0.95), 0 0 3px rgba(250,244,230,0.9)'
						: '0 0 14px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.95), 0 2px 3px rgba(0,0,0,0.9)',
				}}
			>
				{s.text}
			</div>
		</AbsoluteFill>
	);
};

const seg = (a: number, b: number) => ({from: a, durationInFrames: b - a});

export const Film: React.FC<{subtitles: boolean}> = ({subtitles}) => {
	return (
		<AbsoluteFill style={{background: '#000'}}>
			{/* ---------------- I. THE LEGEND — ink on parchment ---------------- */}
			<Sequence {...seg(S.S01, S.S02)}>
				<Parchment />
				<InkReveal start={4} dur={70} seed={11} cy={H * 0.42}>
					<InkClip from={S.S01} dur={S.S02 - S.S01} zoom={[1.0, 1.07]} invert bright={1.25} contrast={1.6} />
				</InkReveal>
			</Sequence>
			<Sequence {...seg(S.S02, S.S03)}>
				<InkClip from={S.S02} dur={S.S03 - S.S02} zoom={[1.02, 1.06]} invert bright={1.25} contrast={1.6} />
				<RedInk at={DROP - S.S02} cx={560} cy={880} r={640} dur={46} />
				<Sequence from={10} durationInFrames={40}>
					<InkFigure src="panels/founders_ink.png" dur={40} revealDur={10} y={260} seed={4} />
				</Sequence>
			</Sequence>
			{/* up the shaft through the rock (dark: inverted so the rock is drawn in ink), then the castle at dusk */}
			<Sequence {...seg(S.S03, S.FLASH)}>
				<InkClip from={S.S03} dur={S.FLASH - S.S03} zoom={[1.0, 1.08]} invert bright={1.2} contrast={1.7} />
			</Sequence>
			<Sequence {...seg(S.FLASH, S.S04)}>
				<InkClip from={S.FLASH} dur={S.S04 - S.FLASH} zoom={[1.0, 1.05]} />
			</Sequence>
			<Sequence {...seg(S.S04, S.S05)}>
				<InkClip from={S.S04} dur={S.S05 - S.S04} contrast={2.0} bright={2.2} tint="rgba(150,30,20,0.6)" />
				<RedInk at={2} cx={540} cy={2100} r={1500} dur={44} seed={33} opacity={0.72} />
			</Sequence>

			{/* ---------------- II. THE LAST NIGHT — painted ---------------- */}
			<Sequence {...seg(S.S05, S.S06)}>
				<PaintedPanel base="panels/sealed_base.png" fg="panels/sealed_fg.png" dur={S.S06 - S.S05} push={[1.03, 1.15]} pan={[20, 10, -10, -30]} shakeAt={SLAM - S.S05} flicker={0.05} />
				<Embers count={46} seed="sealed" color="255,110,50" rise={2.4} />
				<Motes count={50} seed="sealdust" color="220,200,180" fall={0.4} size={3} opacity={0.35} />
				<Flash at={SLAM - S.S05} dur={7} color="#ffd7c0" peak={0.55} />
				<Vignette strength={0.8} />
			</Sequence>
			<Sequence {...seg(S.S06, S.S07)}>
				<Parchment />
				<InkFigure src="panels/queen_ink.png" dur={S.S07 - S.S06} revealDur={12} y={120} scale={[1.02, 1.1]} seed={6} />
				<InkSpill at={S.S07 - S.S06 - 10} dur={10} cx={540} cy={1100} seed={12} />
			</Sequence>
			<Sequence {...seg(S.S07, S.S08)}>
				<PaintedPanel base="panels/king.png" dur={S.S08 - S.S07} push={[1.02, 1.2]} pan={[0, 30, 0, 90]} flicker={0.07} />
				<Embers count={70} seed="king" color="255,120,40" rise={3.5} />
				<Motes count={40} seed="kingdust" color="255,190,140" fall={-0.3} size={3} opacity={0.3} />
				<Vignette strength={0.78} />
			</Sequence>
			<Sequence {...seg(S.S08, S.S09)}>
				<V1Clip from={S.S08} dur={S.S09 - S.S08} grade="contrast(1.2) saturate(1.0) brightness(0.95)" zoom={[1.06, 1.18]} origin="50% 38%" />
				<Embers count={40} seed="heart" color="255,90,30" rise={2} />
				<Vignette strength={0.7} />
			</Sequence>
			<Sequence {...seg(S.S09, S.S10 + 14)}>
				<V1Clip from={S.S09} dur={S.S10 + 14 - S.S09} grade="contrast(1.1) saturate(0.9)" />
				<Vignette strength={0.6} />
			</Sequence>

			{/* ---------------- III. THE CENTURIES — it becomes a story (ink again) ---------------- */}
			<Sequence {...seg(S.S10, S.S11 + 16)}>
				<InkReveal start={0} dur={14} seed={17} cy={H * 0.38}>
					<InkClip from={S.S10} dur={S.S11 + 16 - S.S10} contrast={2.4} bright={3.2} zoom={[1.0, 1.04]} />
				</InkReveal>
			</Sequence>

			{/* ---------------- IV. NOW — painted ---------------- */}
			<Sequence {...seg(S.S11, S.S12)}>
				<InkReveal start={0} dur={16} seed={23} cy={H * 0.6}>
					<PaintedPanel base="panels/road.png" dur={S.S12 - S.S11} push={[1.0, 1.12]} pan={[0, 40, 0, -20]} />
					{/* the moon behind the keep, and the road falling into shadow at her feet */}
					<AbsoluteFill style={{background: 'radial-gradient(circle at 70% 9%, rgba(215,228,255,0.55) 0%, rgba(160,185,235,0.22) 12%, rgba(0,0,0,0) 34%)', mixBlendMode: 'screen'}} />
					{/* ground mist lying along the road's horizon */}
					<AbsoluteFill style={{background: 'linear-gradient(to bottom, rgba(0,0,0,0) 40%, rgba(130,150,190,0.30) 50%, rgba(120,140,180,0.26) 58%, rgba(0,0,0,0) 68%)', mixBlendMode: 'screen', filter: 'blur(6px)'}} />
					<AbsoluteFill style={{background: 'linear-gradient(to bottom, rgba(0,0,0,0) 56%, rgba(2,4,8,0.55) 74%, rgba(2,4,8,0.88) 100%)'}} />
					<Rain count={120} speed={70} opacity={0.18} seed="road" />
					<Vignette strength={0.75} />
				</InkReveal>
			</Sequence>
			<Sequence {...seg(S.S12, S.S13)}>
				<PaintedPanel base="panels/gate.png" dur={S.S13 - S.S12} push={[1.0, 1.1]} pan={[0, 60, 0, 120]} />
				<Rain count={90} speed={70} opacity={0.14} seed="gate" />
				<Motes count={30} seed="gatedust" color="200,215,240" fall={0.5} size={3} opacity={0.3} />
				<Vignette strength={0.72} />
			</Sequence>
			<Sequence {...seg(S.S13, S.S17)}>
				<V1Clip from={S.S13} dur={S.S15 - S.S13} grade="contrast(1.16) saturate(0.82) brightness(0.95)" />
			</Sequence>
			<Sequence {...seg(S.S15, S.S17)}>
				<V1Clip from={S.S15} dur={S.S17 - S.S15} grade="contrast(1.05) saturate(0.85) brightness(1.35)" />
				<Vignette strength={0.62} />
			</Sequence>
			{/* the title: authored and rendered in HyperFrames (tools/cinematic/hyperframes/title) */}
			<Sequence {...seg(S.S17, S.END)}>
				<AbsoluteFill style={{background: '#000'}}>
					<Video src={staticFile('title/title.mp4')} muted style={{width: 1080, height: 1920}} />
				</AbsoluteFill>
			</Sequence>

			<Grain amount={0.085} />
			{subtitles ? <Subtitles /> : null}
			<Audio src={staticFile('audio/mix.wav')} />
		</AbsoluteFill>
	);
};

export const FilmShare: React.FC = () => <Film subtitles />;
export const FilmClean: React.FC = () => <Film subtitles={false} />;
export {Parchment};
