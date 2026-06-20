import type { Subtitle, ProcessingConfig } from './types';
import type { TextNormalizer } from './TextNormalizer';
import type { FrameSource } from './FrameSource';
import type { OCREngine } from './OCREngine';

export class FrameScheduler {
	constructor(
		private config: ProcessingConfig,
		private normalizer: TextNormalizer,
		private frameSource: FrameSource,
		private ocrEngine: OCREngine
	) {}

	async *generateSubtitles(startTime: number, endTime: number): AsyncGenerator<Subtitle> {
		let currentTime = startTime;
		let index = 1;
		let cachedLookahead: { time: number; text: string } | null = null;

		while (currentTime < endTime) {
			// Get frame
			const frame = await this.frameSource.extract(
				currentTime,
				this.config.videoPath,
				this.config.roi
			);

			// OCR (or use cached lookahead)
			let recognizedText: string;
			if (cachedLookahead?.time === currentTime) {
				recognizedText = cachedLookahead.text;
				cachedLookahead = null;
			} else {
				recognizedText = await this.ocrEngine.recognize(
					frame.image,
					this.config.language,
					this.config.recognitionLevel,
					this.config.roi
				);
			}

			const normalizedText = this.normalizer.normalize(recognizedText);

			// Forward-factor lookahead
			let frameAdvance = this.config.interval;
			if (this.config.forwardFactor > 1 && normalizedText && !cachedLookahead) {
				const lookaheadTime: number =
					currentTime + this.config.interval * this.config.forwardFactor;
				if (lookaheadTime < endTime) {
					const lookaheadFrame = await this.frameSource.extract(
						lookaheadTime,
						this.config.videoPath,
						this.config.roi
					);
					const lookaheadTextRaw = await this.ocrEngine.recognize(
						lookaheadFrame.image,
						this.config.language,
						this.config.recognitionLevel,
						this.config.roi
					);
					const lookaheadText = this.normalizer.normalize(lookaheadTextRaw);

					if (normalizedText === lookaheadText) {
						frameAdvance = this.config.interval * (this.config.forwardFactor + 1);
					} else {
						cachedLookahead = { time: lookaheadTime, text: lookaheadText };
					}
				}
			}

			if (normalizedText) {
				yield {
					index: index++,
					startTime: currentTime,
					endTime: Math.min(currentTime + frameAdvance, endTime),
					text: normalizedText
				};
			}

			currentTime += frameAdvance;
		}
	}
}
