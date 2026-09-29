import './index.css';
import {Composition} from 'remotion';
import {DURATION, FPS, FilmClean, FilmShare} from './Film';

export const RemotionRoot: React.FC = () => {
	return (
		<>
			{/* the game's copy: subtitles are drawn by the game (src/ui/Intro.ts) */}
			<Composition id="Opening" component={FilmClean} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} />
			{/* the shareable master: subtitles burned in */}
			<Composition id="OpeningShare" component={FilmShare} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} />
		</>
	);
};
