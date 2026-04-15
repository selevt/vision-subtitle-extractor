# VisionSubtitleExtractor Mac CLI

A macOS command-line application that extracts subtitles from videos using the Vision API.

## Features

- Extracts frames from videos at specified intervals
- Uses OCR (Optical Character Recognition) to detect text in the frames
- Generates SRT subtitle files from the detected text
- Works with various video formats supported by AVFoundation

## Requirements

- macOS 11 (Big Sur) or later
- Swift 5.5 or later
- Xcode 13 or later (for development)

## Installation

1. Clone or download this repository
2. Navigate to the project directory in Terminal
3. Build the project using Swift Package Manager:

```bash
swift build -c release
```

4. The executable will be located in `.build/release/VisionSubtitleExtractor`

## Usage

```bash
VisionSubtitleExtractor <video_path> [--interval <seconds>] [--output <output_path>]
```

### Arguments

- `<video_path>` (required): Path to the input video file
- `--interval <seconds>` (optional): Interval in seconds between extracted frames (default: 1.0)
- `--output <output_path>` (optional): Path to save the SRT file (default: `<video_name>.srt` in the current directory)
- `--roi <x y width height>` (optional): Region of interest for text detection as four space-separated values (all normalized 0.0-1.0). Note that (0,0) is the BOTTOM-LEFT corner of the frame.

### Examples

Extract subtitles from a video with default settings (1 second interval):

```bash
VisionSubtitleExtractor /path/to/movie.mp4
```

Extract subtitles every 2.5 seconds:

```bash
VisionSubtitleExtractor /path/to/movie.mp4 --interval 2.5
```

Specify custom output path:

```bash
VisionSubtitleExtractor /path/to/movie.mp4 --output /path/to/custom_subtitles.srt
```

Use both custom interval and output path:

```bash
VisionSubtitleExtractor /path/to/movie.mp4 --interval 2.0 --output /path/to/custom_subtitles.srt
```

Specify a region of interest (ROI) for text detection (bottom 30% of the frame):

```bash
VisionSubtitleExtractor /path/to/movie.mp4 --roi 0 0 1 0.3
```

Combine all options:

```bash
VisionSubtitleExtractor /path/to/movie.mp4 --interval 1.5 --output /path/to/custom_subtitles.srt --roi 0 0 1 0.3
```

Note: For the ROI parameter, coordinates use (0,0) as the BOTTOM-LEFT corner and (1,1) as the TOP-RIGHT corner.

## How It Works

1. The program loads the video using AVFoundation
2. Frames are extracted at the specified time intervals
3. Vision framework's text recognition (OCR) is applied to each frame
4. Detected text is recorded with its corresponding timestamp
5. An SRT subtitle file is generated from the collected text and timestamps

## Limitations

- OCR accuracy depends on the quality of the video and the clarity of the text
- Best results are achieved with high-resolution videos and clear subtitles
- Processing time depends on video length and the extraction interval

## License

This project is available under the MIT License.
