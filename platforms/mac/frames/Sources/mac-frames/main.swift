import Foundation
import AVFoundation
import AppKit

struct ROI: Decodable {
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

struct Request: Decodable {
    let type: String
    let requestId: Int
    let videoPath: String?
    let time: Double?
    let roi: ROI?
}

struct FrameResponse: Encodable {
    let type: String
    let requestId: Int
    let image: String
    let time: Double
}

struct DurationResponse: Encodable {
    let type: String
    let requestId: Int
    let duration: Double
}

struct ErrorResponse: Encodable {
    let type: String
    let requestId: Int
    let message: String
}

class FrameExtractor {
    private var currentAsset: AVURLAsset?
    private var currentPath: String?

    func setVideo(path: String) {
        if currentPath != path {
            currentPath = path
            currentAsset = AVURLAsset(url: URL(fileURLWithPath: path))
        }
    }

    func extractFrame(at time: Double, roi: ROI? = nil) throws -> CGImage {
        guard let asset = currentAsset else {
            throw NSError(domain: "FrameExtractor", code: 1, userInfo: [NSLocalizedDescriptionKey: "No video loaded"])
        }

        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.requestedTimeToleranceBefore = .zero
        generator.requestedTimeToleranceAfter = .zero

        let cmTime = CMTimeMakeWithSeconds(time, preferredTimescale: 600)
        var actualTime = CMTime.zero
        guard let cgImage = try? generator.copyCGImage(at: cmTime, actualTime: &actualTime) else {
            throw NSError(domain: "FrameExtractor", code: 2, userInfo: [NSLocalizedDescriptionKey: "Failed to extract frame"])
        }
        
        // Apply ROI cropping if specified
        if let roi = roi {
            // Convert from bottom-left (Vision coordinate system) to top-left (CGImage coordinate system)
            // Vision uses bottom-left as origin, CGImage.cropping uses top-left as origin
            let x = Double(cgImage.width) * roi.x
            let y = Double(cgImage.height) * (1.0 - roi.y - roi.height)
            let width = Double(cgImage.width) * roi.width
            let height = Double(cgImage.height) * roi.height
            let cropRect = CGRect(x: x, y: y, width: width, height: height)
            if let croppedImage = cgImage.cropping(to: cropRect) {
                return croppedImage
            }
        }
        
        return cgImage
    }

    func getDuration() throws -> Double {
        guard let asset = currentAsset else {
            throw NSError(domain: "FrameExtractor", code: 1, userInfo: [NSLocalizedDescriptionKey: "No video loaded"])
        }
        return CMTimeGetSeconds(asset.duration)
    }
}

func encodeImage(_ cgImage: CGImage) -> String? {
    let nsImage = NSImage(cgImage: cgImage, size: NSSize(width: cgImage.width, height: cgImage.height))
    guard let tiffData = nsImage.tiffRepresentation,
          let bitmap = NSBitmapImageRep(data: tiffData),
          let jpegData = bitmap.representation(using: NSBitmapImageRep.FileType.jpeg, properties: [NSBitmapImageRep.PropertyKey.compressionFactor: 0.8]) else {
        return nil
    }
    return jpegData.base64EncodedString()
}

func printResponse(_ encodable: Encodable) {
    let encoder = JSONEncoder()
    encoder.outputFormatting = .withoutEscapingSlashes
    if let data = try? encoder.encode(encodable),
       let string = String(data: data, encoding: .utf8) {
        print(string)
        fflush(__stdoutp)
    }
}

func main() {
    let extractor = FrameExtractor()
    
    // Handle command-line arguments (for Tauri sidecar compatibility)
    // Tauri passes JSON as a command-line argument
    if CommandLine.arguments.count > 1 {
        for arg in CommandLine.arguments.dropFirst() {
            if !arg.isEmpty {
                do {
                    let request = try JSONDecoder().decode(Request.self, from: arg.data(using: .utf8)!)
                    switch request.type {
                    case "extract":
                        guard let path = request.videoPath, let time = request.time else {
                            printResponse(ErrorResponse(type: "error", requestId: request.requestId, message: "Missing videoPath or time"))
                            return
                        }
                        extractor.setVideo(path: path)
                        do {
                            let cgImage = try extractor.extractFrame(at: time, roi: request.roi)
                            if let imageBase64 = encodeImage(cgImage) {
                                printResponse(FrameResponse(type: "frame", requestId: request.requestId, image: imageBase64, time: time))
                            } else {
                                printResponse(ErrorResponse(type: "error", requestId: request.requestId, message: "Failed to encode image"))
                            }
                        } catch {
                            printResponse(ErrorResponse(type: "error", requestId: request.requestId, message: error.localizedDescription))
                        }
                    case "getDuration":
                        guard let path = request.videoPath else {
                            printResponse(ErrorResponse(type: "error", requestId: request.requestId, message: "Missing videoPath"))
                            return
                        }
                        extractor.setVideo(path: path)
                        do {
                            let duration = try extractor.getDuration()
                            printResponse(DurationResponse(type: "duration", requestId: request.requestId, duration: duration))
                        } catch {
                            printResponse(ErrorResponse(type: "error", requestId: request.requestId, message: error.localizedDescription))
                        }
                    default:
                        printResponse(ErrorResponse(type: "error", requestId: request.requestId, message: "Unknown request type: \(request.type)"))
                    }
                } catch {
                    let requestId: Int = {
                        guard let data = arg.data(using: .utf8),
                              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                            return 0
                        }
                        return dict["requestId"] as? Int ?? 0
                    }()
                    printResponse(ErrorResponse(type: "error", requestId: requestId, message: "Error: \(error)"))
                }
            }
        }
        return // Exit after processing command-line args
    }

    // Original stdin-based handling
    var inputBuffer = ""

    FileHandle.standardInput.readabilityHandler = { handle in
        let data = handle.availableData
        if let input = String(data: data, encoding: .utf8) {
            inputBuffer += input
            let lines = inputBuffer.components(separatedBy: .newlines)
            inputBuffer = lines.last ?? ""
            for line in lines.dropLast() {
                if line.isEmpty { continue }
                
                do {
                    let request = try JSONDecoder().decode(Request.self, from: line.data(using: .utf8)!)
                    switch request.type {
                    case "extract":
                        guard let path = request.videoPath, let time = request.time else {
                            printResponse(ErrorResponse(type: "error", requestId: request.requestId, message: "Missing videoPath or time"))
                            return
                        }
                        extractor.setVideo(path: path)
                        do {
                            let cgImage = try extractor.extractFrame(at: time, roi: request.roi)
                            if let imageBase64 = encodeImage(cgImage) {
                                printResponse(FrameResponse(type: "frame", requestId: request.requestId, image: imageBase64, time: time))
                            } else {
                                printResponse(ErrorResponse(type: "error", requestId: request.requestId, message: "Failed to encode image"))
                            }
                        } catch {
                            printResponse(ErrorResponse(type: "error", requestId: request.requestId, message: error.localizedDescription))
                        }
                    case "getDuration":
                        guard let path = request.videoPath else {
                            printResponse(ErrorResponse(type: "error", requestId: request.requestId, message: "Missing videoPath"))
                            return
                        }
                        extractor.setVideo(path: path)
                        do {
                            let duration = try extractor.getDuration()
                            printResponse(DurationResponse(type: "duration", requestId: request.requestId, duration: duration))
                        } catch {
                            printResponse(ErrorResponse(type: "error", requestId: request.requestId, message: error.localizedDescription))
                        }
                    default:
                        printResponse(ErrorResponse(type: "error", requestId: request.requestId, message: "Unknown request type: \(request.type)"))
                    }
                } catch {
                    let requestId: Int = {
                        guard let data = line.data(using: .utf8),
                              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                            return 0
                        }
                        return dict["requestId"] as? Int ?? 0
                    }()
                    printResponse(ErrorResponse(type: "error", requestId: requestId, message: "Error: \(error)"))
                }
            }
        }
    }

    RunLoop.main.run()
}

main()
