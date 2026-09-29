import React from 'react';
import {AbsoluteFill, Img, interpolate, random, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

export const W = 1080;
export const H = 1920;

/** A turbulent ink-bleed alpha mask (CSS mask-image): a displaced disc of radius r at (cx, cy). */
export const inkMask = (cx: number, cy: number, r: number, seed: number, rough = 150, freq = 0.011) => {
	const svg =
		`<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'>` +
		`<filter id='f' x='-50%' y='-50%' width='200%' height='200%'>` +
		`<feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='4' seed='${seed}' result='n'/>` +
		`<feDisplacementMap in='SourceGraphic' in2='n' scale='${rough}' xChannelSelector='R' yChannelSelector='G'/>` +
		`<feGaussianBlur stdDeviation='1.6'/></filter>` +
		`<circle cx='${cx}' cy='${cy}' r='${Math.max(0, r)}' fill='white' filter='url(#f)'/></svg>`;
	return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
};

export const maskStyle = (m: string): React.CSSProperties => ({
	maskImage: m,
	WebkitMaskImage: m,
	maskSize: '100% 100%',
	WebkitMaskSize: '100% 100%',
	maskRepeat: 'no-repeat',
	WebkitMaskRepeat: 'no-repeat',
});

/** Ink bleeding outward from a point over [start, start+dur) frames (local frame). */
export const InkReveal: React.FC<{
	start: number;
	dur: number;
	cx?: number;
	cy?: number;
	seed?: number;
	children: React.ReactNode;
}> = ({start, dur, cx = W / 2, cy = H / 2, seed = 3, children}) => {
	const f = useCurrentFrame();
	const t = interpolate(f, [start, start + dur], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	if (t >= 1) return <AbsoluteFill>{children}</AbsoluteFill>;
	const e = 1 - Math.pow(1 - t, 2.2);
	const r = e * 1500;
	return <AbsoluteFill style={maskStyle(inkMask(cx, cy, r, seed, 110 + 200 * e))}>{children}</AbsoluteFill>;
};

/** Animated film grain + gentle exposure flicker. */
export const Grain: React.FC<{amount?: number}> = ({amount = 0.09}) => {
	const f = useCurrentFrame();
	const seed = (f * 7919) % 997;
	const svg =
		`<svg xmlns='http://www.w3.org/2000/svg' width='540' height='960'>` +
		`<filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='${seed}'/>` +
		`<feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(#g)'/></svg>`;
	return (
		<AbsoluteFill
			style={{
				backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`,
				backgroundSize: '100% 100%',
				opacity: amount,
				mixBlendMode: 'overlay',
				pointerEvents: 'none',
			}}
		/>
	);
};

export const Vignette: React.FC<{strength?: number}> = ({strength = 0.72}) => (
	<AbsoluteFill
		style={{
			background: `radial-gradient(ellipse 72% 58% at 50% 46%, rgba(0,0,0,0) 45%, rgba(0,0,0,${strength}) 100%)`,
			pointerEvents: 'none',
		}}
	/>
);

/** Slanted rain streaks (deterministic). */
export const Rain: React.FC<{count?: number; speed?: number; slant?: number; opacity?: number; seed?: string}> = ({
	count = 170,
	speed = 95,
	slant = -0.18,
	opacity = 0.35,
	seed = 'rain',
}) => {
	const f = useCurrentFrame();
	return (
		<AbsoluteFill style={{pointerEvents: 'none', opacity}}>
			{new Array(count).fill(0).map((_, i) => {
				const depth = 0.4 + random(`${seed}-d-${i}`) * 0.6;
				const len = 60 + depth * 120;
				const x0 = random(`${seed}-x-${i}`) * (W + 400) - 200;
				const y = ((random(`${seed}-y-${i}`) * (H + len) + f * speed * depth) % (H + len)) - len;
				const x = x0 + (y + len) * slant;
				return (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: x,
							top: y,
							width: 1.2 + depth * 1.4,
							height: len,
							transform: `rotate(${-slant * 57}deg)`,
							background: 'linear-gradient(to bottom, rgba(200,215,235,0), rgba(210,225,245,0.9))',
							opacity: 0.35 + depth * 0.65,
						}}
					/>
				);
			})}
		</AbsoluteFill>
	);
};

/** Embers rising in heat (warm points that flicker and drift). */
export const Embers: React.FC<{count?: number; seed?: string; color?: string; rise?: number}> = ({
	count = 60,
	seed = 'emb',
	color = '255,150,60',
	rise = 3.2,
}) => {
	const f = useCurrentFrame();
	return (
		<AbsoluteFill style={{pointerEvents: 'none', mixBlendMode: 'screen'}}>
			{new Array(count).fill(0).map((_, i) => {
				const r = (k: string) => random(`${seed}-${k}-${i}`);
				const life = 60 + r('l') * 90;
				const t = ((f + r('o') * life) % life) / life;
				const x = r('x') * W + Math.sin((f + r('p') * 100) / (14 + r('q') * 18)) * 40 * r('a');
				const y = H * (0.55 + r('y') * 0.55) - t * H * 0.25 * rise * (0.5 + r('s'));
				const s = 2 + r('z') * 5;
				const a = Math.sin(t * Math.PI) * (0.5 + 0.5 * Math.sin(f * (0.6 + r('fl')) + i));
				return (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: x,
							top: y,
							width: s,
							height: s,
							borderRadius: '50%',
							background: `rgba(${color},${Math.max(0, a)})`,
							boxShadow: `0 0 ${s * 3}px ${s}px rgba(${color},${Math.max(0, a) * 0.6})`,
						}}
					/>
				);
			})}
		</AbsoluteFill>
	);
};

/** Drifting ash/snow/dust motes. */
export const Motes: React.FC<{count?: number; seed?: string; color?: string; fall?: number; size?: number; opacity?: number}> = ({
	count = 90,
	seed = 'mote',
	color = '235,235,240',
	fall = 1.4,
	size = 4,
	opacity = 0.7,
}) => {
	const f = useCurrentFrame();
	return (
		<AbsoluteFill style={{pointerEvents: 'none', opacity}}>
			{new Array(count).fill(0).map((_, i) => {
				const r = (k: string) => random(`${seed}-${k}-${i}`);
				const depth = 0.3 + r('d') * 0.7;
				const y = ((r('y') * (H + 40) + f * fall * depth * 2) % (H + 40)) - 20;
				const x = r('x') * W + Math.sin((f + r('p') * 200) / (30 + r('q') * 30)) * 30 * depth;
				const s = size * (0.4 + depth);
				return (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: x,
							top: y,
							width: s,
							height: s,
							borderRadius: '50%',
							background: `rgba(${color},${0.35 + depth * 0.6})`,
							filter: `blur(${(1 - depth) * 2}px)`,
						}}
					/>
				);
			})}
		</AbsoluteFill>
	);
};

/** Low mist drifting across (a pre-made soft noise texture). */
export const Mist: React.FC<{opacity?: number; speed?: number; top?: number; tint?: string}> = ({
	opacity = 0.35,
	speed = 0.6,
	top = 0,
	tint = 'none',
}) => {
	const f = useCurrentFrame();
	return (
		<AbsoluteFill
			style={{
				pointerEvents: 'none',
				overflow: 'hidden',
				opacity,
				maskImage: `linear-gradient(to bottom, transparent ${top}px, black ${top + 380}px, black ${top + 900}px, transparent ${top + 1300}px)`,
				WebkitMaskImage: `linear-gradient(to bottom, transparent ${top}px, black ${top + 380}px, black ${top + 900}px, transparent ${top + 1300}px)`,
			}}
		>
			<Img
				src={staticFile('tex/mist.png')}
				style={{position: 'absolute', top, left: -((f * speed) % 1080), width: 2160, height: H, filter: tint}}
			/>
		</AbsoluteFill>
	);
};

/** Camera shake (decaying) from an impact at local frame `at`. */
export const useShake = (at: number, px = 12, decay = 9) => {
	const f = useCurrentFrame();
	if (f < at) return {x: 0, y: 0};
	const k = Math.exp(-(f - at) / decay);
	return {x: Math.sin(f * 2.7) * px * k, y: Math.cos(f * 3.3) * px * k * 0.8};
};

export const useFps = () => useVideoConfig().fps;
