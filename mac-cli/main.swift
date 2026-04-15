import Foundation
import Vision
import AVFoundation
import ArgumentParser

// MARK: - Logging Protocol and Implementations

protocol Logger {
    func info(_ message: String)
    func debug(_ message: String)
    func error(_ message: String)
    func progress(percent: Double, progressBar: String, framesProcessed: Int, totalFrames: Int)
    func progressComplete()
    func subtitle(at time: String, text: String)
    func clearLine()
    func supportedLanguages(_ languages: [String])
}

class StandardLogger: Logger {
    func info(_ message: String) {
        print(message)
        fflush(__stdoutp)
    }
    
    func debug(_ message: String) {
        print(message)
        fflush(__stdoutp)
    }
    
    func error(_ message: String) {
        print(message)
        fflush(__stdoutp)
    }
    
    func progress(percent: Double, progressBar: String, framesProcessed: Int, totalFrames: Int) {
        let percentStr = String(format: "%3d", Int(percent * 100))
        let framesStr = "Frames: \(framesProcessed)/\(totalFrames)"
        let bar = "[\(progressBar)] \(percentStr)%  \(framesStr)"
        print("\r\(bar)", terminator: "")
        fflush(__stdoutp)
    }
    
    func progressComplete() {
        print("")
        fflush(__stdoutp)
    }
    
    func subtitle(at time: String, text: String) {
        print("\rFrame at \(time): \(text)")
        fflush(__stdoutp)
    }
    
    func clearLine() {
        // Clear the progress bar line
        print("\r" + String(repeating: " ", count: 37))
        fflush(__stdoutp)
    }
    
    func supportedLanguages(_ languages: [String]) {
        print("Supported recognition languages:")
        for language in languages {
            print("- \(language)")
        }
        fflush(__stdoutp)
    }
}

class JSONLogger: Logger {
    func info(_ message: String) {
        let json: [String: Any] = [
            "type": "info",
            "message": message
        ]
        printJSON(json)
    }
    
    func debug(_ message: String) {
        let json: [String: Any] = [
            "type": "debug",
            "message": message
        ]
        printJSON(json)
    }
    
    func error(_ message: String) {
        let json: [String: Any] = [
            "type": "error",
            "message": message
        ]
        printJSON(json)
    }
    
    func progress(percent: Double, progressBar: String, framesProcessed: Int, totalFrames: Int) {
        let json: [String: Any] = [
            "type": "progress",
            "progressFraction": percent,
            "percentComplete": Int(percent * 100),
            "progressBar": progressBar,
            "framesProcessed": framesProcessed,
            "totalFrames": totalFrames
        ]
        printJSON(json)
    }
    
    func progressComplete() {
        // Nothing to do for JSON logger
    }
    
    func subtitle(at time: String, text: String) {
        let json: [String: Any] = [
            "type": "subtitle",
            "time": time,
            "text": text
        ]
        printJSON(json)
    }
    
    func clearLine() {
        // Nothing to do for JSON logger
    }
    
    func supportedLanguages(_ languages: [String]) {
        let json: [String: Any] = [
            "type": "languages",
            "supportedLanguages": languages
        ]
        printJSON(json)
    }
    
    private func printJSON(_ json: [String: Any]) {
        if let jsonData = try? JSONSerialization.data(withJSONObject: json),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            print(jsonString)
            fflush(__stdoutp)
        }
    }
}

struct Substitution: Codable {
    let regex: String
    let replacement: String
}

struct SubtitleExtractorCLI: ParsableCommand {
    @Argument(help: "Path to the video file.")
    var videoPath: String?

    @Option(name: .shortAndLong, help: "Frame extraction interval in seconds.")
    var interval: Double = 1.0

    @Option(name: .shortAndLong, help: "Output SRT file path. Defaults to <video>.srt")
    var output: String?

    @Option(name: .long, parsing: .upToNextOption, help: "Region of interest as x y width height (normalized 0.0-1.0)")
    var roi: [Double] = []
    
    @Option(name: [.short, .long], help: "Recognition language code (e.g., 'en-US', 'ko', 'ja')")
    var language: String?
    
    @Option(name: .long, help: "Text recognition level: 'accurate' or 'fast'. Defaults to 'accurate'.")
    var recognitionLevel: String = "accurate"
    
    @Flag(name: .long, help: "Output in JSON format.")
    var json: Bool = false
    
    @Flag(name: .long, help: "List supported recognition languages.")
    var listLanguages: Bool = false

    @Option(name: .customLong("substitution"), help: "JSON string of a substitution (regex, replacement). Can be repeated.")
    var rawSubstitutions: [String] = []

    func run() throws {
        let logger: Logger = json ? JSONLogger() : StandardLogger()
        
            // Handle the list-languages flag
        if listLanguages {
            // Get supported languages using VNRecognizeTextRequest
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = recognitionLevel == "fast" ? .fast : .accurate
            
            do {
                let supportedLanguages = try request.supportedRecognitionLanguages()
                logger.supportedLanguages(supportedLanguages)
            } catch {
                logger.error("Failed to get supported languages: \(error.localizedDescription)")
            }
            return
        }
        
        // Ensure we have a video path when not listing languages
        guard let videoPath = videoPath else {
            throw ValidationError("Video path is required unless using --list-languages")
        }
        
        let outputPath = output ?? "\(URL(fileURLWithPath: videoPath).deletingPathExtension().lastPathComponent).srt"
        var regionOfInterest: CGRect? = nil
        if roi.count == 4 {
            regionOfInterest = CGRect(x: roi[0], y: roi[1], width: roi[2], height: roi[3])
        } else if !roi.isEmpty {
            throw ValidationError("ROI must be four numbers: x y width height (all normalized 0.0-1.0)")
        }

        logger.info("Starting subtitle extraction process...")
        logger.info("Video: \(videoPath)")
        logger.info("Interval: \(interval) seconds")
        logger.info("Output: \(outputPath)")
        if let roi = regionOfInterest {
            logger.info("Region of interest: x=\(roi.origin.x), y=\(roi.origin.y), width=\(roi.size.width), height=\(roi.size.height)")
            logger.info("Note: Coordinates use (0,0) as BOTTOM-LEFT corner and (1,1) as TOP-RIGHT corner")
        } else {
            logger.info("Region of interest: Full frame")
        }
        
        if let language = language {
            logger.info("Recognition language: \(language)")
        } else {
            logger.info("Recognition language: Default")
        }

        var substitutions: [Substitution] = []
        for rawSub in rawSubstitutions {
            if let data = rawSub.data(using: .utf8),
               let sub = try? JSONDecoder().decode(Substitution.self, from: data) {
                substitutions.append(sub)
            } else {
                logger.error("Failed to parse substitution: \(rawSub)")
            }
        }

        Task {
            do {
                let extractor = SubtitleExtractor(
                    videoPath: videoPath,
                    intervalInSeconds: interval,
                    outputPath: outputPath,
                    regionOfInterest: regionOfInterest,
                    language: language,
                    recognitionLevel: recognitionLevel,
                    substitutions: substitutions,
                    logger: logger
                )
                try await extractor.prepare()
                let success = try await extractor.extractSubtitles()
                if success {
                    logger.info("Subtitle extraction completed successfully")
                } else {
                    logger.info("Subtitle extraction failed")
                }
            } catch {
                logger.error("Error during subtitle extraction: \(error.localizedDescription)")
                logger.error("Error type: \(type(of: error))")
                logger.error("Error debug: \(error)")
                if let nsError = error as NSError? {
                    logger.error("NSError domain: \(nsError.domain)")
                    logger.error("NSError code: \(nsError.code)")
                    logger.error("NSError userInfo: \(nsError.userInfo)")
                }
            }
            Foundation.exit(0)
        }
        dispatchMain()
    }
}

SubtitleExtractorCLI.main()

// MARK: - Subtitle Extractor

class SubtitleExtractor {
    private let videoURL: URL
    private let asset: AVURLAsset
    private let intervalInSeconds: Double
    private let outputPath: String
    private let regionOfInterest: CGRect?
    private let language: String?
    private let recognitionLevel: String
    private let substitutions: [Substitution]
    private let logger: Logger
    
    private var subtitles: [Subtitle] = []
    private var currentFrameTime: CMTime = .zero
    private var videoDuration: CMTime = .zero
    
    init(videoPath: String, intervalInSeconds: Double, outputPath: String, regionOfInterest: CGRect? = nil, language: String? = nil, recognitionLevel: String = "accurate", substitutions: [Substitution] = [], logger: Logger) {
        self.videoURL = URL(fileURLWithPath: videoPath)
        self.asset = AVURLAsset(url: videoURL)
        self.intervalInSeconds = intervalInSeconds
        self.outputPath = outputPath
        self.regionOfInterest = regionOfInterest
        self.language = language
        self.recognitionLevel = recognitionLevel
        self.substitutions = substitutions
        self.logger = logger
        
        // Get video duration - this is now handled in prepare()
    }
    
    // Prepare the extractor by loading video metadata
    func prepare() async throws {
        // Get video duration
        self.videoDuration = try await asset.load(.duration)
    }
    
    // MARK: - Extract Subtitles
    
    func extractSubtitles() async throws -> Bool {
        logger.info("Starting subtitle extraction from \(videoURL.lastPathComponent)")
        logger.info("Video duration: \(CMTimeGetSeconds(videoDuration)) seconds")
        logger.info("Extracting frames every \(intervalInSeconds) seconds")
        
        // Reset state
        subtitles.removeAll()
        currentFrameTime = .zero
        
        logger.info("Analyzing frames (this may take some time)...")
        
        // Process frames at regular intervals
        await processFrames()
        
        logger.info("Processing complete. Generating SRT file...")
        writeSubtitlesToFile()
        return true
    }
    
    private func processFrames() async {
        // Start at a small offset from zero to avoid "Cannot Open" error with exact zero time
        currentFrameTime = CMTimeMakeWithSeconds(0.1, preferredTimescale: 600)

        let totalSeconds = CMTimeGetSeconds(videoDuration)
        let totalFrames = Int(totalSeconds / intervalInSeconds)
        var framesProcessed = 0
        let progressBarWidth = 30
    // let startTime = Date() // elapsed is now frontend only
        while CMTimeCompare(currentFrameTime, videoDuration) < 0 {
            let currentSeconds = CMTimeGetSeconds(currentFrameTime)
            let progressPercent = min(currentSeconds / totalSeconds, 1.0)
            let progressBarFilled = Int(progressPercent * Double(progressBarWidth))
            let progressBar = String(repeating: "█", count: progressBarFilled) + String(repeating: "░", count: progressBarWidth - progressBarFilled)

            // Calculate elapsed time
            logger.progress(percent: progressPercent, progressBar: progressBar, framesProcessed: framesProcessed, totalFrames: totalFrames)

            // Generate image from the current time
            if let image = try? await generateImageFromVideo(at: currentFrameTime) {
                // Perform OCR on the image
                var recognizedText = await performOCR(on: image)

                for sub in substitutions {
                    recognizedText = recognizedText.replacingOccurrences(of: sub.regex, with: sub.replacement, options: .regularExpression)
                }

                if !recognizedText.isEmpty {
                    let startTime = currentFrameTime
                    var endTime = CMTimeAdd(startTime, CMTimeMakeWithSeconds(intervalInSeconds, preferredTimescale: 600))

                    // Ensure endTime doesn't exceed video duration
                    if CMTimeCompare(endTime, videoDuration) > 0 {
                        endTime = videoDuration
                    }

                    let subtitle = Subtitle(
                        index: subtitles.count + 1,
                        startTime: startTime,
                        endTime: endTime,
                        text: recognizedText
                    )

                    subtitles.append(subtitle)
                    // Clear the progress bar line and print the subtitle info
                    logger.clearLine()
                    logger.subtitle(at: formatTime(startTime), text: recognizedText)
                }
            }

            framesProcessed += 1
            // Move to the next time interval
            currentFrameTime = CMTimeAdd(currentFrameTime, CMTimeMakeWithSeconds(intervalInSeconds, preferredTimescale: 600))
        }

        // Print 100% progress at the end
        let completeProgressBar = String(repeating: "█", count: progressBarWidth)
    logger.progress(percent: 1.0, progressBar: completeProgressBar, framesProcessed: totalFrames, totalFrames: totalFrames)
        logger.progressComplete()
    }

    // Utility for formatting elapsed time as HH:MM:SS
    static func formatElapsedTime(_ interval: TimeInterval) -> String {
        let ti = Int(interval)
        let seconds = ti % 60
        let minutes = (ti / 60) % 60
        let hours = ti / 3600
        return String(format: "%02d:%02d:%02d", hours, minutes, seconds)
    }
    
    // MARK: - Image Generation
    
    private func generateImageFromVideo(at time: CMTime) async throws -> CGImage? {
        let imageGenerator = AVAssetImageGenerator(asset: asset)
        imageGenerator.appliesPreferredTrackTransform = true
        imageGenerator.requestedTimeToleranceBefore = CMTime.zero
        imageGenerator.requestedTimeToleranceAfter = CMTime.zero
        
        do {
            let (cgImage, _) = try await imageGenerator.image(at: time)
            return cgImage
        } catch {
            logger.error("Error generating image: \(error.localizedDescription)")
            return nil
        }
    }
    
    // MARK: - OCR Processing
    
    private func performOCR(on cgImage: CGImage) async -> String {
        let requestHandler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        
        do {
            let request = VNRecognizeTextRequest()
            // Set recognition level based on configuration
            request.recognitionLevel = recognitionLevel == "fast" ? .fast : .accurate
            request.usesLanguageCorrection = true
            
            // Use configured language or default
            if let language = self.language {
                request.recognitionLanguages = [language]
                logger.debug("Using specified language: \(language)")
            } else {
                // Default behavior - using system default language
                logger.debug("Using system default language")
            }
            
            // Apply region of interest if specified
            if let roi = regionOfInterest {
                request.regionOfInterest = roi
            }
            
            try requestHandler.perform([request])
            
            // Get observations from request results
            guard let observations = request.results else { return "" }
            
            // Extract the recognized text
            let recognizedStrings = observations.compactMap { observation in
                observation.topCandidates(1).first?.string
            }
            
            // Join the recognized text into a single string
            return recognizedStrings.joined(separator: " ")
        } catch {
            logger.error("Failed to perform OCR: \(error.localizedDescription)")
            return ""
        }
    }
    
    // MARK: - SRT File Generation
    
    private func writeSubtitlesToFile() {
        guard !subtitles.isEmpty else {
            logger.info("No subtitles were detected in the video")
            return
        }

        var mergedSubtitles: [Subtitle] = []
        var currentSubtitle: Subtitle? = nil

        for subtitle in subtitles {
            if let curr = currentSubtitle {
                // Merge if text is the same, or if the new text starts with the previous text
                if curr.text == subtitle.text || subtitle.text.hasPrefix(curr.text) {
                    // Extend the endTime and use the longer text
                    let mergedText = subtitle.text.count > curr.text.count ? subtitle.text : curr.text
                    var endTime = subtitle.endTime
                    
                    // Ensure endTime doesn't exceed video duration
                    if CMTimeCompare(endTime, videoDuration) > 0 {
                        endTime = videoDuration
                    }
                    
                    currentSubtitle = Subtitle(
                        index: curr.index,
                        startTime: curr.startTime,
                        endTime: endTime,
                        text: mergedText
                    )
                } else {
                    mergedSubtitles.append(curr)
                    currentSubtitle = Subtitle(
                        index: curr.index + 1,
                        startTime: subtitle.startTime,
                        endTime: subtitle.endTime,
                        text: subtitle.text
                    )
                }
            } else {
                currentSubtitle = Subtitle(
                    index: 1,
                    startTime: subtitle.startTime,
                    endTime: subtitle.endTime,
                    text: subtitle.text
                )
            }
        }
        if let curr = currentSubtitle {
            mergedSubtitles.append(curr)
        }

        // Re-index merged subtitles
        var srtContent = ""
        let ms10 = CMTimeMake(value: 10, timescale: 1000) // 10 milliseconds
        for (i, subtitle) in mergedSubtitles.enumerated() {
            var endTime = subtitle.endTime
            // If this is the last subtitle and its endTime is at or after videoDuration, subtract 10ms
            if i == mergedSubtitles.count - 1 && CMTimeCompare(endTime, videoDuration) >= 0 {
                endTime = CMTimeSubtract(videoDuration, ms10)
                if CMTimeCompare(endTime, subtitle.startTime) <= 0 {
                    // If subtracting 10ms would make endTime before startTime, set endTime = subtitle.startTime
                    endTime = subtitle.startTime
                }
            }
            srtContent += "\(i+1)\n"
            srtContent += "\(formatSRTTime(subtitle.startTime)) --> \(formatSRTTime(endTime))\n"
            srtContent += "\(subtitle.text)\n\n"
        }

        do {
            try srtContent.write(toFile: outputPath, atomically: true, encoding: .utf8)
            logger.info("Successfully wrote \(mergedSubtitles.count) subtitles to \(outputPath)")
        } catch {
            logger.error("Error writing SRT file: \(error.localizedDescription)")
        }
    }
    
    // MARK: - Utility Functions
    
    private func formatTime(_ time: CMTime) -> String {
        let seconds = CMTimeGetSeconds(time)
        return String(format: "%.2f", seconds)
    }
    
    private func formatSRTTime(_ time: CMTime) -> String {
        let totalSeconds = Int(CMTimeGetSeconds(time))
        let hours = totalSeconds / 3600
        let minutes = (totalSeconds % 3600) / 60
        let seconds = totalSeconds % 60
        let milliseconds = Int((CMTimeGetSeconds(time).truncatingRemainder(dividingBy: 1)) * 1000)
        
        return String(format: "%02d:%02d:%02d,%03d", hours, minutes, seconds, milliseconds)
    }
}

// MARK: - Subtitle Model

struct Subtitle {
    let index: Int
    let startTime: CMTime
    let endTime: CMTime
    let text: String
}

