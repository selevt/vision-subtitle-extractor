export interface ExtractOptions {
  filePath: string;
  outputPath: string;

  language?: string;
  intervalMs?: number;
  /** region of interest. This is to limit OCR processing to a specific area */
  roi?: string;
  /** recognition level: 'fast' or 'accurate' */
  recognitionLevel?: 'fast' | 'accurate';

  /**
   * Optional callback to receive progress updates
   */
  onProgress?: (progress: {
    progressFraction: number;
    percentComplete: number;
    framesProcessed?: number;
    totalFrames?: number;
  }) => void;

  substitutions?: { regex: string; replacement: string }[];
}
export interface ExtractResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

export enum Capability {
    OPTION_INTERVAL = 1,
    /**
     * Requires implementation of `roiFormat` function as well as support for `roi` option in `extract` function
     */
    REGION_OF_INTEREST = 2,
    /**
     * Indicates support for language selection
     */
    LANGUAGE_SELECTION = 4,
    /**
     * Indicates support for recognition level selection (fast vs accurate)
     */
    RECOGNITION_LEVEL = 8,
    /**
     * Indicates backend can provide separate language lists per recognition level
     */
    RECOGNITION_LEVEL_PER_LANGUAGE = 16,
}

export interface SupportedLanguage {
    code: string;
    name?: string; // Optional human-readable name
}

export interface Backend {
    capabilities: number;
    /** Format for the region of interest */
    roiFormat?: () => string;
    /**
     * Get supported recognition languages
     */
    getSupportedLanguages?: () => Promise<SupportedLanguage[]>;
    /**
     * Get supported recognition languages for a specific recognition level
     */
    getSupportedLanguagesForLevel?: (level: 'fast' | 'accurate') => Promise<SupportedLanguage[]>;
    extract(options: ExtractOptions): Promise<ExtractResult>;
}

export function hasCapability(backend: Backend, capability: Capability): boolean {
    return (backend.capabilities & capability) === capability;
}