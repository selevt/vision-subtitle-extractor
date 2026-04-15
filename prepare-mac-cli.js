import { execSync } from 'child_process';
import fs from 'fs';

const extension = process.platform === 'win32' ? '.exe' : '';

const rustInfo = execSync('rustc -vV');
const targetTriple = /host: (\S+)/g.exec(rustInfo)[1];
if (!targetTriple) {
	console.error('Failed to determine platform target triple');
}
execSync('cd mac-cli && swift build -c release && cd ..');

if (!fs.existsSync('src-tauri/binaries')) {
	fs.mkdirSync('src-tauri/binaries');
}
fs.copyFileSync(
	`mac-cli/.build/release/vision-subtitle-extractor-mac`,
	`src-tauri/binaries/vision-subtitle-extractor-mac-${targetTriple}${extension}`
);
