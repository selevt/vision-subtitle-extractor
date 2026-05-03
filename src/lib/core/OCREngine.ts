export interface OCREngine {
	recognize(
		image: string,
		language?: string,
		recognitionLevel?: 'fast' | 'accurate',
		roi?: { x: number; y: number; width: number; height: number }
	): Promise<string>;
}

export class MockOCREngine implements OCREngine {
	private responses: Map<string, string>;

	constructor(responses: Map<string, string>) {
		this.responses = responses;
	}

	async recognize(
		image: string,
		_language?: string,
		_recognitionLevel?: 'fast' | 'accurate',
		_roi?: { x: number; y: number; width: number; height: number }
	): Promise<string> {
		const response = this.responses.get(image);
		if (response === undefined) {
			throw new Error(`No mock response for image ${image.substring(0, 20)}...`);
		}
		return response;
	}
}
