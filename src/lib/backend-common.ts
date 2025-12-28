export interface ExtractOptions {
  filePath: string;
  outputPath: string;

  language?: string;
  intervalMs?: number;
  /** region of interest. This is to limit OCR processing to a specific area */
  roi?: string;

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
    extract(options: ExtractOptions): Promise<ExtractResult>;
}

export function hasCapability(backend: Backend, capability: Capability): boolean {
    return (backend.capabilities & capability) === capability;
}