// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "FlowCastVoice",
    platforms: [.macOS(.v14)],
    dependencies: [
        .package(url: "https://github.com/FluidInference/FluidAudio.git", exact: "0.15.7")
    ],
    targets: [
        .executableTarget(
            name: "FlowCastVoice",
            dependencies: [.product(name: "FluidAudio", package: "FluidAudio")]
        )
    ]
)
