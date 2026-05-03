# Vision Subtitle Extractor

Extract subtitles from videos with OCR.

## Architecture

The project uses a modular architecture with a JS/TS core and platform-specific OCR binaries.

### Quick Start

```sh
# Build the JS/TS core
pnpm run build

# Build platform binaries (macOS)
pnpm run build:platform-binaries

# Run the CLI
node dist/index.js /path/to/video.mp4 --output subtitles.srt
```

### Architecture Overview

The system consists of:

- **JS/TS Core** (`src/lib/core/`): Main logic for frame scheduling, forward-factor optimization, text substitution, and SRT generation
- **Platform Binaries** (`platforms/`): Platform-specific OCR engines and frame extractors
  - `platforms/mac/ocr/`: Swift-based Vision OCR engine
  - `platforms/mac/frames/`: Swift-based AVFoundation frame extractor

The JS core communicates with platform binaries via JSON over stdin/stdout (NDJSON protocol).

## Developing

Compile the JS/TS core:

```sh
pnpm run build
```

Compile platform binaries (macOS):

```sh
pnpm run build:platform-binaries
```

Run tests:

```sh
pnpm test
```

Run frontend (requires building the system first):

```sh
pnpm run tauri dev
```

## Usage

### CLI

```sh
node dist/index.js [options] <video-file>

Options:
  --output, -o       Output SRT file path (default: <video>.srt)
  --interval, -i     Frame extraction interval in seconds (default: 1.0)
  --forwardFactor    Forward-looking skip factor (default: 1)
  --substitution    JSON substitution pattern: '{"regex":"pattern","replacement":"text"}'
  --language         OCR language code (e.g., 'en', 'ko', 'ja')
  --startTimeMs      Start time in milliseconds
  --endTimeMs        End time in milliseconds
  --platform         Platform: 'auto', 'mac', or 'win' (default: 'auto')
  --jsonOutput       Output in JSON format
  --help, -h         Show help
```

## Contributing

See the project documentation for details on the architecture and development.

## License

MIT
