export interface Config {
	videoPath: string;
	outputPath: string;
	interval: number;
	forwardFactor: number;
	substitutions: Array<{ regex: string; replacement: string }>;
	language?: string;
	roi?: { x: number; y: number; width: number; height: number };
	recognitionLevel?: 'fast' | 'accurate';
	startTimeMs?: number;
	endTimeMs?: number;
	platform: 'auto' | 'mac' | 'win';
	jsonOutput: boolean;
}

// Processing options passed to FrameScheduler
export interface ProcessingConfig {
	interval: number;
	forwardFactor: number;
	videoPath: string;
	language?: string;
	roi?: { x: number; y: number; width: number; height: number };
	recognitionLevel?: 'fast' | 'accurate';
}

export interface Subtitle {
	index: number;
	startTime: number;
	endTime: number;
	text: string;
}

export interface FrameData {
	image: string;
	time: number;
}

export type FrameRequest = {
	type: 'extract';
	videoPath: string;
	time: number;
	requestId: number;
	roi?: { x: number; y: number; width: number; height: number };
};

export type FrameResponse = {
	type: 'frame';
	requestId: number;
	image: string;
	time: number;
};

export type OCRRequest = {
	type: 'recognize';
	image: string;
	language?: string;
	recognitionLevel?: 'fast' | 'accurate';
	roi?: { x: number; y: number; width: number; height: number };
	requestId: number;
};

export type OCRResponse = {
	type: 'text';
	requestId: number;
	text: string;
};

export type DurationRequest = {
	type: 'getDuration';
	videoPath: string;
	requestId: number;
};

export type DurationResponse = {
	type: 'duration';
	requestId: number;
	duration: number;
};

export type ErrorResponse = {
	type: 'error';
	requestId: number;
	message: string;
};

export type PlatformMessage =
	| FrameRequest
	| OCRRequest
	| DurationRequest
	| FrameResponse
	| OCRResponse
	| DurationResponse
	| ErrorResponse;
