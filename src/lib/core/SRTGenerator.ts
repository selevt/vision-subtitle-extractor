import type { Subtitle } from './types';

export class SRTGenerator {
	static formatSRTTime(seconds: number): string {
		const totalMs = Math.round(seconds * 1000);
		const ms = totalMs % 1000;
		const totalSec = Math.floor(totalMs / 1000);
		const sec = totalSec % 60;
		const min = Math.floor(totalSec / 60) % 60;
		const hours = Math.floor(totalSec / 3600);
		return `${hours.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
	}

	static mergeSubtitles(subtitles: Subtitle[]): Subtitle[] {
		if (subtitles.length === 0) return [];

		const merged: Subtitle[] = [];
		let current = { ...subtitles[0] };

		for (let i = 1; i < subtitles.length; i++) {
			const next = subtitles[i];
			if (
				current.text === next.text ||
				next.text.startsWith(current.text) ||
				current.text.startsWith(next.text)
			) {
				current.endTime = next.endTime;
				current.text = next.text.length > current.text.length ? next.text : current.text;
			} else {
				merged.push(current);
				current = { ...next, index: merged.length + 1 };
			}
		}
		merged.push(current);
		return merged;
	}

	static generateSRT(mergedSubtitles: Subtitle[]): string {
		if (mergedSubtitles.length === 0) return '';
		const ms10 = 0.01;
		return (
			mergedSubtitles
				.map((sub, i) => {
					let endTime = sub.endTime;
					if (i === mergedSubtitles.length - 1) {
						endTime = Math.max(sub.startTime + 0.1, endTime - ms10);
					}
					return `${i + 1}\n${this.formatSRTTime(sub.startTime)} --> ${this.formatSRTTime(endTime)}\n${sub.text}\n`;
				})
				.join('\n') + '\n'
		);
	}
}
