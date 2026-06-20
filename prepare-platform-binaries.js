import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const extension = process.platform === 'win32' ? '.exe' : '';

// Determine target triple
let targetTriple;
try {
	const rustInfo = execSync('rustc -vV', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
	targetTriple = /host: (\S+)/g.exec(rustInfo)?.[1];
} catch {
	// Fallback: construct target triple from platform and arch
	const platformMap = {
		darwin: 'apple-darwin',
		linux: 'unknown-linux-gnu',
		win32: 'pc-windows-msvc'
	};
	const archMap = {
		x64: 'x86_64',
		arm64: 'aarch64'
	};
	targetTriple = `${archMap[process.arch] || process.arch}-${platformMap[process.platform] || process.platform}`;
}

if (!targetTriple) {
	console.error('Failed to determine platform target triple');
	process.exit(1);
}

const basePath = process.cwd();
const binariesDir = path.join(basePath, 'src-tauri/binaries');

// Create binaries directory if it doesn't exist
if (!fs.existsSync(binariesDir)) {
	fs.mkdirSync(binariesDir, { recursive: true });
}

console.log('Building macOS platform binaries...');

// Build mac-frames
console.log('Building mac-frames...');
execSync('cd platforms/mac/frames && swift build -c release && cd ../../..', {
	stdio: 'inherit'
});

// Build mac-ocr
console.log('Building mac-ocr...');
execSync('cd platforms/mac/ocr && swift build -c release && cd ../../..', {
	stdio: 'inherit'
});

// Copy binaries to src-tauri/binaries
const framesSrc = path.join(basePath, 'platforms/mac/frames/.build/release/mac-frames');
const ocrSrc = path.join(basePath, 'platforms/mac/ocr/.build/release/mac-ocr');

// Copy with target triple suffix
const framesDest = path.join(binariesDir, `mac-frames-${targetTriple}${extension}`);
const ocrDest = path.join(binariesDir, `mac-ocr-${targetTriple}${extension}`);

console.log(`Copying mac-frames to ${framesDest}`);
fs.copyFileSync(framesSrc, framesDest);

console.log(`Copying mac-ocr to ${ocrDest}`);
fs.copyFileSync(ocrSrc, ocrDest);

console.log('\n✅ Platform binaries built and copied to src-tauri/binaries/');
console.log(`   - ${framesDest}`);
console.log(`   - ${ocrDest}`);
