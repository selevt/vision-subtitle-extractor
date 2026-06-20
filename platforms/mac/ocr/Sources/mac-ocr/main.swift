import Foundation
import Vision
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
    let image: String?
    let language: String?
    let recognitionLevel: String?
    let roi: ROI?
}

struct Response: Encodable {
    let type: String
    let requestId: Int
    let text: String?
    let message: String?
    let version: String?

    init(type: String, requestId: Int, text: String? = nil, message: String? = nil, version: String? = nil) {
        self.type = type
        self.requestId = requestId
        self.text = text
        self.message = message
        self.version = version
    }
}

struct LanguagesResponse: Encodable {
    let type: String
    let requestId: Int
    let languages: [String]
    let recognitionLevel: String?

    init(type: String, requestId: Int, languages: [String], recognitionLevel: String? = nil) {
        self.type = type
        self.requestId = requestId
        self.languages = languages
        self.recognitionLevel = recognitionLevel
    }
}

func performOCR(on cgImage: CGImage, language: String?, recognitionLevel: String?, roi: ROI?) -> String {
    let requestHandler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    let request = VNRecognizeTextRequest()
    
    // Set recognition level
    if let recognitionLevel = recognitionLevel {
        request.recognitionLevel = recognitionLevel == "fast" ? .fast : .accurate
    } else {
        request.recognitionLevel = .accurate
    }
    
    request.usesLanguageCorrection = true

    if let language = language {
        request.recognitionLanguages = [language]
    }
    
    // Apply ROI if specified
    if let roi = roi {
        request.regionOfInterest = CGRect(
            x: roi.x,
            y: roi.y,
            width: roi.width,
            height: roi.height
        )
    }

    do {
        try requestHandler.perform([request])
        guard let observations = request.results else { return "" }
        return observations.compactMap { $0.topCandidates(1).first?.string }.joined(separator: " ")
    } catch {
        return ""
    }
}

func getSupportedLanguages(for recognitionLevel: String?) -> [String] {
    let request = VNRecognizeTextRequest()
    if let recognitionLevel = recognitionLevel {
        request.recognitionLevel = recognitionLevel == "fast" ? .fast : .accurate
    } else {
        request.recognitionLevel = .accurate
    }
    
    // Get supported languages from the Vision framework
    // Note: supportedRecognitionLanguages() returns languages for the current recognition level
    do {
        let languages = try request.supportedRecognitionLanguages()
        return languages
    } catch {
        // Fallback to a known list if the API fails
        return ["en", "en-US", "en-GB", "fr", "fr-FR", "de", "de-DE", "it", "it-IT", "es", "es-ES", "pt", "pt-PT", "pt-BR", "ru", "ru-RU", "zh", "zh-Hans", "zh-Hant", "ja", "ja-JP", "ko", "ko-KR"]
    }
}

func jsonString(from encodable: Encodable) -> String {
    let encoder = JSONEncoder()
    encoder.outputFormatting = .withoutEscapingSlashes
    if let data = try? encoder.encode(encodable),
       let string = String(data: data, encoding: .utf8) {
        return string
    }
    return "{}"
}

func main() {
    var inputBuffer = ""
    
    // Handle command-line arguments (for Tauri sidecar compatibility)
    if CommandLine.arguments.count > 1 {
        for arg in CommandLine.arguments.dropFirst() {
            if !arg.isEmpty {
                do {
                    let request = try JSONDecoder().decode(Request.self, from: arg.data(using: .utf8)!)

                    switch request.type {
                    case "recognize":
                        guard let imageBase64 = request.image,
                              let imageData = Data(base64Encoded: imageBase64)
                        else {
                            print(jsonString(from: Response(type: "error", requestId: request.requestId, message: "Invalid image data")))
                            return
                        }
                        guard let nsImage = NSImage(data: imageData),
                              let cgImage = nsImage.cgImage(forProposedRect: nil, context: nil, hints: nil)
                        else {
                            print(jsonString(from: Response(type: "error", requestId: request.requestId, message: "Invalid image data")))
                            return
                        }
                        let text = performOCR(on: cgImage, language: request.language, recognitionLevel: request.recognitionLevel, roi: request.roi)
                        print(jsonString(from: Response(type: "text", requestId: request.requestId, text: text)))

                    case "init":
                        print(jsonString(from: Response(type: "ready", requestId: request.requestId, version: "1.0")))

                    case "getLanguages":
                        let languages = getSupportedLanguages(for: request.recognitionLevel)
                        let response = LanguagesResponse(type: "languages", requestId: request.requestId, languages: languages, recognitionLevel: request.recognitionLevel)
                        print(jsonString(from: response))

                    default:
                        print(jsonString(from: Response(type: "error", requestId: request.requestId, message: "Unknown request type: \(request.type)")))
                    }
                } catch {
                    let requestId: Int = {
                        guard let data = arg.data(using: .utf8),
                              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                            return 0
                        }
                        return dict["requestId"] as? Int ?? 0
                    }()
                    print(jsonString(from: Response(type: "error", requestId: requestId, message: "JSON decode error: \(error)")))
                }
            }
        }
        return
    }

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
                    case "recognize":
                        guard let imageBase64 = request.image,
                              let imageData = Data(base64Encoded: imageBase64)
                        else {
                            let response = Response(type: "error", requestId: request.requestId, message: "Invalid image data")
                            print(jsonString(from: response))
                            fflush(__stdoutp)
                            return
                        }
                        guard let nsImage = NSImage(data: imageData),
                              let cgImage = nsImage.cgImage(forProposedRect: nil, context: nil, hints: nil)
                        else {
                            let response = Response(type: "error", requestId: request.requestId, message: "Invalid image data")
                            print(jsonString(from: response))
                            fflush(__stdoutp)
                            return
                        }
                        let language = request.language
                        let text = performOCR(on: cgImage, language: language, recognitionLevel: request.recognitionLevel, roi: request.roi)
                        let response = Response(type: "text", requestId: request.requestId, text: text)
                        print(jsonString(from: response))
                        fflush(__stdoutp)

                    case "init":
                        let response = Response(type: "ready", requestId: request.requestId, version: "1.0")
                        print(jsonString(from: response))
                        fflush(__stdoutp)

                    case "getLanguages":
                        let languages = getSupportedLanguages(for: request.recognitionLevel)
                        let response = LanguagesResponse(type: "languages", requestId: request.requestId, languages: languages, recognitionLevel: request.recognitionLevel)
                        print(jsonString(from: response))
                        fflush(__stdoutp)

                    default:
                        let response = Response(type: "error", requestId: request.requestId, message: "Unknown request type: \(request.type)")
                        print(jsonString(from: response))
                        fflush(__stdoutp)
                    }
                } catch {
                    let requestId: Int = {
                        guard let data = line.data(using: .utf8),
                              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                            return 0
                        }
                        return dict["requestId"] as? Int ?? 0
                    }()
                    let response = Response(type: "error", requestId: requestId, message: "JSON decode error: \(error)")
                    print(jsonString(from: response))
                    fflush(__stdoutp)
                }
            }
        }
    }

    RunLoop.main.run()
}

main()
