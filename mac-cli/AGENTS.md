<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# VisionSubtitleExtractor Project Instructions

This is a Swift command-line application that uses macOS Vision API for OCR (Optical Character Recognition) to extract subtitles from videos.

## Key Components

- AVFoundation for video frame extraction
- Vision framework for text recognition
- SRT subtitle file generation

## Implementation Details

- The application extracts frames at regular intervals from a video file
- It applies OCR to detect text in each frame
- The detected text is formatted into an SRT subtitle file with proper timestamps
- The program handles command line arguments for video path, interval, and output path

When suggesting changes or improvements to this project, consider:

- Performance optimizations for large video files
- Improved text recognition accuracy
- Filter methods to reduce false positives in detected text
- Support for additional subtitle formats beyond SRT
