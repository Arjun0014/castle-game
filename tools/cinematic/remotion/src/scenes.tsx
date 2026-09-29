import React from 'react';
import {Video} from '@remotion/media';
import {AbsoluteFill, Img, interpolate, Easing, staticFile, useCurrentFrame} from 'remotion';
import {H, InkReveal, W, inkMask, maskStyle, useShake} from './fx';

const V1 = staticFile('v1/v1_clean.mp4');

/** The old parchment the legend is written on. */
export const Parchment: React.FC<{drift?: number}> = ({drift = 0.02}) => {
	const f = useCurrentFrame();
	return (
		<AbsoluteFill style={{background: '#e7dcc6'}}>
			<Img src={staticFile('tex/parchment.png')} style={{width: W, height: H, transform: `scale(${1.04 + f * drift * 0.001})`}} />
		</AbsoluteFill>
	);
};

/**
 * A stretch of the first film (v1) re-inked onto parchment: its darks become sepia ink, its lights the page.
 * `from` is the v1 frame this clip starts at (the film clock is shared, so it is usually the same frame).
 */
export const InkClip: React.FC<{from: number; contrast?: number; bright?: number; tint?: string; zoom?: [number, number]; dur: number; invert?: boolean}> = ({
	from,
	contrast = 1.9,
	bright = 1.2,
	tint = 'rgba(110,70,35,0.55)',
	zoom = [1.0, 1.05],
	dur,
	invert = false,
}) => {
	const f = useCurrentFrame();
	const s = interpolate(f, [0, dur], zoom, {extrapolateRight: 'clamp'});
	return (
		<AbsoluteFill>
			<Parchment />
			<AbsoluteFill style={{mixBlendMode: 'multiply', transform: `scale(${s})`}}>
				<Video
					src={V1}
					trimBefore={from}
					muted
					style={{width: W, height: H, filter: `grayscale(1) ${invert ? 'invert(1) ' : ''}brightness(${bright}) contrast(${contrast})`}}
				/>
			</AbsoluteFill>
			{/* the ink is sepia, not black: tint what the multiply darkened */}
			<AbsoluteFill style={{background: tint, mixBlendMode: 'screen', opacity: 0.35}} />
		</AbsoluteFill>
	);
};

/** An ink-wash figure (transparent PNG) laid onto the page, bleeding in. */
export const InkFigure: React.FC<{src: string; revealAt?: number; revealDur?: number; y?: number; scale?: [number, number]; dur: number; seed?: number}> = ({
	src,
	revealAt = 0,
	revealDur = 18,
	y = 0,
	scale = [1.0, 1.06],
	dur,
	seed = 5,
}) => {
	const f = useCurrentFrame();
	const s = interpolate(f, [0, dur], scale);
	return (
		<InkReveal start={revealAt} dur={revealDur} seed={seed} cy={H * 0.45}>
			<AbsoluteFill style={{mixBlendMode: 'multiply'}}>
				<Img src={staticFile(src)} style={{position: 'absolute', width: W, height: H, top: y, transform: `scale(${s})`}} />
			</AbsoluteFill>
		</InkReveal>
	);
};

/** A painted panel (1440x2560 source) with a slow push and a parallax foreground. */
export const PaintedPanel: React.FC<{
	base: string;
	fg?: string;
	dur: number;
	push?: [number, number];
	pan?: [number, number, number, number];
	fgPush?: [number, number];
	shakeAt?: number;
	flicker?: number;
	filter?: string;
}> = ({base, fg, dur, push = [1.0, 1.1], pan = [0, 0, 0, 0], fgPush = [1.05, 1.28], shakeAt, flicker = 0, filter = 'none'}) => {
	const f = useCurrentFrame();
	const t = interpolate(f, [0, dur], [0, 1], {easing: Easing.inOut(Easing.sin)});
	const sh = useShake(shakeAt ?? 1e9, 14, 7);
	const s = push[0] + (push[1] - push[0]) * t;
	const x = pan[0] + (pan[2] - pan[0]) * t + sh.x;
	const y = pan[1] + (pan[3] - pan[1]) * t + sh.y;
	const fl = flicker ? 1 + flicker * (Math.sin(f * 0.9) * 0.5 + Math.sin(f * 2.3 + 1) * 0.3 + Math.sin(f * 5.1) * 0.2) : 1;
	const img: React.CSSProperties = {position: 'absolute', width: W, height: H, objectFit: 'cover'};
	return (
		<AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
			<AbsoluteFill style={{transform: `translate(${x}px, ${y}px) scale(${s})`, filter: `brightness(${fl}) ${filter}`}}>
				<Img src={staticFile(base)} style={img} />
			</AbsoluteFill>
			{fg ? (
				<AbsoluteFill
					style={{
						transform: `translate(${x * 2.2}px, ${y * 1.6}px) scale(${fgPush[0] + (fgPush[1] - fgPush[0]) * t})`,
						filter: `blur(${3 + t * 3}px) brightness(${0.85 * fl})`,
					}}
				>
					<Img src={staticFile(fg)} style={img} />
				</AbsoluteFill>
			) : null}
		</AbsoluteFill>
	);
};

/** A stretch of the first film kept as painted light, regraded to sit with the new panels. */
export const V1Clip: React.FC<{from: number; dur: number; grade?: string; zoom?: [number, number]; origin?: string}> = ({
	from,
	dur,
	grade = 'contrast(1.14) saturate(0.78) brightness(0.96)',
	zoom = [1.0, 1.0],
	origin = '50% 50%',
}) => {
	const f = useCurrentFrame();
	const s = interpolate(f, [0, dur], zoom);
	return (
		<AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
			<AbsoluteFill style={{transform: `scale(${s})`, transformOrigin: origin}}>
				<Video src={V1} trimBefore={from} muted style={{width: W, height: H, filter: grade}} />
			</AbsoluteFill>
			{/* cold steel in the shadows, like the painted panels */}
			<AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(28,40,58,0.55), rgba(10,14,22,0.35))', mixBlendMode: 'soft-light'}} />
		</AbsoluteFill>
	);
};

/** Red ink blooming on the page (the blood). */
export const RedInk: React.FC<{at: number; cx: number; cy: number; r: number; dur?: number; seed?: number; opacity?: number}> = ({
	at,
	cx,
	cy,
	r,
	dur = 40,
	seed = 21,
	opacity = 0.85,
}) => {
	const f = useCurrentFrame();
	if (f < at) return null;
	const t = interpolate(f, [at, at + dur], [0, 1], {extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
	return (
		<AbsoluteFill
			style={{
				...maskStyle(inkMask(cx, cy, r * t, seed, 90 + 120 * t, 0.018)),
				background: `radial-gradient(circle at ${cx}px ${cy}px, rgba(120,8,6,${opacity}) 0%, rgba(150,14,10,${opacity * 0.9}) 40%, rgba(110,6,6,${opacity}) 100%)`,
				mixBlendMode: 'multiply',
			}}
		/>
	);
};

/** Black ink spilling across the frame (a wipe to darkness), local frames [at, at+dur). */
export const InkSpill: React.FC<{at: number; dur: number; cx?: number; cy?: number; seed?: number; color?: string}> = ({
	at,
	dur,
	cx = W / 2,
	cy = H / 2,
	seed = 8,
	color = '#050403',
}) => {
	const f = useCurrentFrame();
	if (f < at) return null;
	const t = interpolate(f, [at, at + dur], [0, 1], {extrapolateRight: 'clamp', easing: Easing.in(Easing.quad)});
	return <AbsoluteFill style={{...maskStyle(inkMask(cx, cy, t * 1500, seed, 180)), background: color}} />;
};

export const Flash: React.FC<{at: number; dur?: number; color?: string; peak?: number}> = ({at, dur = 6, color = '#fff2e0', peak = 0.8}) => {
	const f = useCurrentFrame();
	const a = interpolate(f, [at, at + 1, at + dur], [0, peak, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	return a > 0 ? <AbsoluteFill style={{background: color, opacity: a, mixBlendMode: 'screen'}} /> : null;
};
