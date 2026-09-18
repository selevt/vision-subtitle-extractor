/**
 * Named profiles bundling extraction settings so the user can switch between
 * video sources without re-tuning ROI and other options each time.
 */

export interface RoiData {
	selectionData: any; // matches video-area-selection's VideoAreaSelectionData
	formatted?: string;
}

export interface ProfileSettings {
	intervalMs: number;
	roi: RoiData | undefined;
	selectedLanguage: string | undefined;
	recognitionLevel: 'fast' | 'accurate';
	substitutions: { regex: string; replacement: string }[];
	forwardFactor: number;
	startTimeMs: number | undefined;
	endTimeMs: number | undefined;
}

export interface Profile {
	name: string;
	settings: ProfileSettings;
	updatedAt: number;
}

/**
 * Compare two settings objects for equality.
 * JSON.stringify comparison is safe because both sides are produced by the
 * same captureSettings() shape, so key order is stable.
 */
export function settingsEqual(a: ProfileSettings, b: ProfileSettings): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}
