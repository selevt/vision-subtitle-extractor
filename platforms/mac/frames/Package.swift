// swift-tools-version:5.7
import PackageDescription

let package = Package(
    name: "mac-frames",
    platforms: [.macOS(.v12)],
    products: [
        .executable(name: "mac-frames", targets: ["mac-frames"])
    ],
    targets: [
        .executableTarget(
            name: "mac-frames",
            path: "Sources/mac-frames"
        )
    ]
)
