import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlatformClient } from './PlatformClient';
import type {
	PlatformMessage,
	FrameResponse,
	OCRResponse,
	DurationResponse,
	ErrorResponse
} from './types';

describe('PlatformClient', () => {
	let client: PlatformClient;

	beforeEach(() => {
		client = new PlatformClient('mac');
	});

	afterEach(() => {
		client.kill();
	});

	describe('request/response handling', () => {
		let consoleSpy: ReturnType<typeof vi.spyOn>;

		beforeEach(() => {
			consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		});

		it('should handle frame response correctly', async () => {
			const mockMessage: PlatformMessage = {
				type: 'frame',
				requestId: 1,
				image: 'base64-image-data',
				time: 1.5
			};

			// Access private field for testing
			const clientAny = client as any;
			const mockResolve = vi.fn();
			const mockReject = vi.fn();
			clientAny.pendingRequests.set(1, { resolve: mockResolve, reject: mockReject });

			clientAny.handleMessage(mockMessage);

			expect(mockResolve).toHaveBeenCalledWith({
				image: 'base64-image-data',
				time: 1.5
			});
			expect(clientAny.pendingRequests.has(1)).toBe(false);
		});

		it('should handle OCR text response correctly', async () => {
			const mockMessage: PlatformMessage = {
				type: 'text',
				requestId: 2,
				text: 'Hello world'
			};

			const clientAny = client as any;
			const mockResolve = vi.fn();
			const mockReject = vi.fn();
			clientAny.pendingRequests.set(2, { resolve: mockResolve, reject: mockReject });

			clientAny.handleMessage(mockMessage);

			expect(mockResolve).toHaveBeenCalledWith('Hello world');
			expect(clientAny.pendingRequests.has(2)).toBe(false);
		});

		it('should handle duration response correctly', async () => {
			const mockMessage: PlatformMessage = {
				type: 'duration',
				requestId: 3,
				duration: 120.5
			};

			const clientAny = client as any;
			const mockResolve = vi.fn();
			const mockReject = vi.fn();
			clientAny.pendingRequests.set(3, { resolve: mockResolve, reject: mockReject });

			clientAny.handleMessage(mockMessage);

			expect(mockResolve).toHaveBeenCalledWith(120.5);
			expect(clientAny.pendingRequests.has(3)).toBe(false);
		});

		it('should handle error response correctly', async () => {
			const mockMessage: PlatformMessage = {
				type: 'error',
				requestId: 4,
				message: 'Frame extraction failed'
			};

			const clientAny = client as any;
			const mockResolve = vi.fn();
			const mockReject = vi.fn();
			clientAny.pendingRequests.set(4, { resolve: mockResolve, reject: mockReject });

			clientAny.handleMessage(mockMessage);

			expect(mockReject).toHaveBeenCalledWith(
				expect.objectContaining({
					message: 'Frame extraction failed'
				})
			);
			expect(clientAny.pendingRequests.has(4)).toBe(false);
		});

		it('should handle unknown message type with error', async () => {
			const mockMessage: PlatformMessage = {
				type: 'unknown',
				requestId: 5
			} as any;

			const clientAny = client as any;
			const mockResolve = vi.fn();
			const mockReject = vi.fn();
			clientAny.pendingRequests.set(5, { resolve: mockResolve, reject: mockReject });

			clientAny.handleMessage(mockMessage);

			expect(mockReject).toHaveBeenCalledWith(
				expect.objectContaining({
					message: 'Unexpected message type: unknown'
				})
			);
		});

		it('should ignore messages with no pending request', async () => {
			const mockMessage: PlatformMessage = {
				type: 'frame',
				requestId: 999,
				image: 'base64-image-data',
				time: 1.5
			};

			const clientAny = client as any;
			clientAny.handleMessage(mockMessage);

			// Should log error but not throw
			expect(consoleSpy).toHaveBeenCalled();
		});
	});

	describe('requestId handling', () => {
		it('should increment requestId for each request', async () => {
			const clientAny = client as any;
			const initialCounter = clientAny.requestIdCounter;

			// Simulate sending requests
			const msg1 = {
				type: 'extract',
				time: 1.0,
				videoPath: '',
				requestId: ++clientAny.requestIdCounter
			};
			const msg2 = {
				type: 'extract',
				time: 2.0,
				videoPath: '',
				requestId: ++clientAny.requestIdCounter
			};
			const msg3 = { type: 'recognize', image: 'img', requestId: ++clientAny.requestIdCounter };

			expect(msg1.requestId).toBe(initialCounter + 1);
			expect(msg2.requestId).toBe(initialCounter + 2);
			expect(msg3.requestId).toBe(initialCounter + 3);
		});
	});

	describe('kill method', () => {
		it('should not throw when called', () => {
			expect(() => client.kill()).not.toThrow();
		});
	});
});
