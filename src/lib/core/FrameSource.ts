import type { FrameData } from './types';

export interface FrameSource {
	extract(
		time: number,
		videoPath: string,
		roi?: { x: number; y: number; width: number; height: number }
	): Promise<FrameData>;
	getDuration(videoPath: string): Promise<number>;
}

export class MockFrameSource implements FrameSource {
	private responses: Map<number, FrameData>;
	private duration: number;

	constructor(responses: Map<number, FrameData>, duration: number = 100) {
		this.responses = responses;
		this.duration = duration;
	}

	async extract(
		time: number,
		_videoPath: string,
		_roi?: { x: number; y: number; width: number; height: number }
	): Promise<FrameData> {
		const response = this.responses.get(time);
		if (!response) {
			throw new Error(`No mock response for time ${time}`);
		}
		return response;
	}

	async getDuration(_videoPath: string): Promise<number> {
		return this.duration;
	}
}
