import { spawn, ChildProcess } from 'node:child_process';
import type {
	FrameData,
	PlatformMessage,
	FrameResponse,
	OCRResponse,
	DurationResponse,
	ErrorResponse,
	FrameRequest,
	OCRRequest,
	DurationRequest
} from './types';
import type { FrameSource } from './FrameSource';
import type { OCREngine } from './OCREngine';

export class PlatformClient implements FrameSource, OCREngine {
	private frameProcess: ChildProcess | null = null;
	private ocrProcess: ChildProcess | null = null;
	private requestIdCounter = 0;
	private pendingRequests: Map<
		number,
		{ resolve: (result: any) => void; reject: (error: Error) => void }
	> = new Map();

	constructor(platform: 'mac' | 'win', executablePath?: string) {
		const basePath = executablePath || process.cwd();
		const frameBin =
			platform === 'mac'
				? `${basePath}/platforms/mac/frames/.build/release/mac-frames`
				: `${basePath}/platforms/win/frames/win-frames.exe`;
		const ocrBin =
			platform === 'mac'
				? `${basePath}/platforms/mac/ocr/.build/release/mac-ocr`
				: `${basePath}/platforms/win/ocr/win-ocr.exe`;

		this.frameProcess = this.spawnProcess(frameBin);
		this.ocrProcess = this.spawnProcess(ocrBin);
		if (this.frameProcess) this.setupListeners(this.frameProcess, 'frame');
		if (this.ocrProcess) this.setupListeners(this.ocrProcess, 'ocr');
	}

	private spawnProcess(path: string): ChildProcess | null {
		try {
			return spawn(path, { stdio: ['pipe', 'pipe', 'pipe', 'ipc'] });
		} catch {
			return null;
		}
	}

	private setupListeners(process: ChildProcess, source: string) {
		let buffer = '';
		process.stdout?.on('data', (data: Buffer) => {
			buffer += data.toString('utf8');
			const lines = buffer.split('\n');
			buffer = lines.pop() || '';
			for (const line of lines) {
				if (!line.trim()) continue;
				try {
					const msg = JSON.parse(line) as PlatformMessage;
					this.handleMessage(msg);
				} catch (e) {
					console.error(`[${source}] Failed to parse:`, line, e);
				}
			}
		});

		process.stderr?.on('data', (data: Buffer) => {
			console.error(`[${source}] stderr:`, data.toString('utf8'));
		});

		process.on('error', (err) => {
			console.error(`[${source}] process error:`, err);
		});

		process.on('exit', (code) => {
			console.error(`[${source}] process exited with code ${code}`);
		});
	}

	private handleMessage(msg: PlatformMessage) {
		const requestId = 'requestId' in msg ? msg.requestId : 0;
		const pending = this.pendingRequests.get(requestId);
		if (!pending) {
			const errorMsg = 'message' in msg ? (msg as any).message : 'N/A';
			console.error(
				`No pending request for id ${requestId}, message type: ${msg.type}, message: ${errorMsg}`
			);
			return;
		}

		switch (msg.type) {
			case 'frame':
				pending.resolve({ image: (msg as FrameResponse).image, time: (msg as FrameResponse).time });
				break;
			case 'text':
				pending.resolve((msg as OCRResponse).text);
				break;
			case 'duration':
				pending.resolve((msg as DurationResponse).duration);
				break;
			case 'error':
				pending.reject(new Error((msg as ErrorResponse).message));
				break;
			default:
				pending.reject(new Error(`Unexpected message type: ${msg.type}`));
		}
		this.pendingRequests.delete(requestId);
	}

	async extract(
		time: number,
		videoPath: string,
		roi?: { x: number; y: number; width: number; height: number }
	): Promise<FrameData> {
		if (!this.frameProcess) {
			throw new Error('Frame process not available');
		}
		const request: FrameRequest = {
			type: 'extract',
			time,
			videoPath,
			requestId: ++this.requestIdCounter,
			...(roi && { roi })
		};
		return this.sendRequest<FrameData>(this.frameProcess, request);
	}

	async getDuration(videoPath: string): Promise<number> {
		if (!this.frameProcess) {
			throw new Error('Frame process not available');
		}
		const request: DurationRequest = {
			type: 'getDuration',
			videoPath,
			requestId: ++this.requestIdCounter
		};
		return this.sendRequest<number>(this.frameProcess, request);
	}

	async recognize(
		image: string,
		language?: string,
		recognitionLevel?: 'fast' | 'accurate',
		roi?: { x: number; y: number; width: number; height: number }
	): Promise<string> {
		if (!this.ocrProcess) {
			throw new Error('OCR process not available');
		}
		const request: OCRRequest = {
			type: 'recognize',
			image,
			requestId: ++this.requestIdCounter,
			...(language && { language }),
			...(recognitionLevel && { recognitionLevel }),
			...(roi && { roi })
		};
		return this.sendRequest<string>(this.ocrProcess, request);
	}

	private async sendRequest<T>(
		process: ChildProcess,
		msg: FrameRequest | DurationRequest | OCRRequest
	): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			this.pendingRequests.set(msg.requestId, { resolve, reject });
			process.stdin?.write(JSON.stringify(msg) + '\n');
		});
	}

	kill(): void {
		this.frameProcess?.kill();
		this.ocrProcess?.kill();
	}
}
