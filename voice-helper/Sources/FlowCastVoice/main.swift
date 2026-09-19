// FlowCast Voice: a menu-bar helper that gives the FlowCast web app fast,
// offline speech recognition. It runs NVIDIA Parakeet on the Neural Engine
// (via FluidAudio, the engine behind FluidVoice) and serves it to the browser
// over a loopback WebSocket. The browser still owns the microphone and cuts
// the audio into clips; this only turns clips into text.
//
// Wire format (must match lib/voice-local-engine.ts):
//   browser -> helper  binary: uint32 LE clip id, then Float32 LE samples, 16 kHz mono
//   browser -> helper  text:   {"type":"vocabulary","terms":["Habakkuk","Philemon",...]}
//                              words to favour when the audio supports them
//   helper -> browser  text:   {"type":"ready"} once the model is loaded, then
//                              {"type":"result","id":1,"text":"...","ms":42}
//                              {"type":"error","id":1,"message":"..."}

import AppKit
import FluidAudio
import Network

let managed = CommandLine.arguments.contains("--managed")
let environment = ProcessInfo.processInfo.environment
let port: UInt16 = managed ? 0 : 47821
let voiceToken = environment["FLOWCAST_VOICE_TOKEN"] ?? ""
let voiceOrigin = environment["FLOWCAST_VOICE_ORIGIN"] ?? ""
let modelsRoot = environment["FLOWCAST_VOICE_MODELS"].map { URL(fileURLWithPath: $0, isDirectory: true) }

func emit(_ message: [String: Any]) {
    guard managed, let data = try? JSONSerialization.data(withJSONObject: message),
          let text = String(data: data, encoding: .utf8) else { return }
    print("FLOWCAST:" + text)
}

func modelDirectory(_ defaultDirectory: URL) -> URL? {
    modelsRoot?.appendingPathComponent(defaultDirectory.lastPathComponent, isDirectory: true)
}
func progressText(_ name: String, _ progress: DownloadProgress) -> String {
    let percent = Int(progress.fractionCompleted * 100)
    switch progress.phase {
    case .listing: return "Checking \(name)..."
    case .downloading(let done, let total):
        return "Downloading \(name): \(percent)%" + (total > 0 ? " (\(done)/\(total) files)" : "")
    case .compiling: return "Preparing \(name): \(percent)%"
    }
}
// Only FlowCast may use the recognizer, not any web page that finds the port.
func isAllowedOrigin(_ origin: String?) -> Bool {
    if managed { return !voiceOrigin.isEmpty && origin == voiceOrigin }
    guard let origin, let url = URL(string: origin), let host = url.host else { return false }
    return host == "localhost" || host == "127.0.0.1" || host == "bible.kelvinamoaba.com"
}

actor Transcriber {
    private var manager: AsrManager?
    private var boosting: VocabularyBoostingSession?

    // The custom dictionary. A second, small CTC model listens for these
    // words; where the audio backs one up better than what Parakeet wrote
    // ("Natam" vs "Nahum"), the transcript is corrected. No retraining.
    func setVocabulary(_ words: [String], progress: ProgressHandler? = nil) async throws -> Int {
        let terms = words.map { CustomVocabularyTerm(text: $0) }
        let directory = modelDirectory(CtcModels.defaultCacheDirectory()) ?? CtcModels.defaultCacheDirectory()
        // CtcModels.download reports no progress, so fetch the same files through ModelHub, which does.
        if let progress, !CtcModels.modelsExist(at: directory) {
            let names = [ModelNames.CTC.melSpectrogramPath, ModelNames.CTC.audioEncoderPath]
            for (index, name) in names.enumerated() {
                _ = try await ModelHub.loadModels(
                    CtcModelVariant.ctc110m.repo, modelNames: [name],
                    directory: directory.deletingLastPathComponent()
                ) { step in
                    progress(DownloadProgress(
                        fractionCompleted: (Double(index) + step.fractionCompleted) / Double(names.count), phase: step.phase))
                }
            }
        }
        let ctcModels = try await CtcModels.downloadAndLoad(to: directory)
        boosting = try await VocabularyBoostingSession(
            vocabulary: CustomVocabularyContext(terms: terms), ctcModels: ctcModels)
        return terms.count
    }

    func load(progress: ProgressHandler? = nil) async throws {
        // v2 = English-only Parakeet TDT 0.6B; better recall on rare words than v3.
        let models = try await AsrModels.downloadAndLoad(to: modelDirectory(AsrModels.defaultCacheDirectory(for: .v2)), version: .v2, progressHandler: progress)
        let manager = AsrManager(config: .default)
        try await manager.loadModels(models)
        self.manager = manager
    }

    var isReady: Bool { manager != nil }

    func transcribe(_ samples: [Float]) async throws -> String {
        guard let manager else { throw ASRError.notInitialized }
        // The model rejects clips under a second; trailing silence is harmless.
        var audio = samples
        if audio.count < 16000 { audio += [Float](repeating: 0, count: 16000 - audio.count) }
        var state = TdtDecoderState.make()
        let result = try await manager.transcribe(audio, decoderState: &state)
        guard let boosting, let timings = result.tokenTimings else { return result.text }
        let rescored = await boosting.rescore(text: result.text, tokenTimings: timings, audioSamples: audio)
        return rescored?.text ?? result.text
    }
}

final class Server: @unchecked Sendable {
    let transcriber = Transcriber()
    var listener: NWListener?
    var connections: [ObjectIdentifier: NWConnection] = [:]
    var onStatus: (String) -> Void = { _ in }

    var prepared = false
    var loadingTask: Task<Void, Never>?
    var currentStatus = "Preparing voice recognition..."

    func status(_ message: String) {
        DispatchQueue.main.async {
            self.currentStatus = message
            self.onStatus(message)
            self.connections.values.forEach { self.send($0, ["type": "status", "message": message]) }
        }
    }

    func start() {
        if !managed { Task {
            do {
                onStatus("Loading speech model…")
                try await transcriber.load()
                onStatus("Ready")
                DispatchQueue.main.async { self.connections.values.forEach { self.send($0, ["type": "ready"]) } }
            } catch {
                onStatus("Model failed: \(error.localizedDescription)")
            }
        }

        }
        let websocket = NWProtocolWebSocket.Options()
        websocket.autoReplyPing = true
        websocket.maximumMessageSize = 8 << 20
        websocket.setClientRequestHandler(.main) { protocols, headers in
            let origin = headers.first { $0.name.lowercased() == "origin" }?.value
            let authenticated = !managed || (!voiceToken.isEmpty && protocols.contains { $0.trimmingCharacters(in: .whitespaces) == voiceToken })
            return .init(status: isAllowedOrigin(origin) && authenticated ? .accept : .reject,
                         subprotocol: managed && authenticated ? "flowcast" : nil)
        }
        let parameters = NWParameters.tcp
        parameters.acceptLocalOnly = true
        parameters.requiredInterfaceType = .loopback
        parameters.defaultProtocolStack.applicationProtocols.insert(websocket, at: 0)

        do {
            let listener = try NWListener(using: parameters, on: NWEndpoint.Port(rawValue: port)!)
            listener.newConnectionHandler = { [weak self] connection in self?.accept(connection) }
            listener.stateUpdateHandler = { [weak self] state in
                if case .ready = state, let boundPort = self?.listener?.port {
                    emit(["type": "listening", "port": boundPort.rawValue])
                }
                if case .failed(let error) = state {
                    self?.status("Voice listener failed: \(error)")
                    if managed { exit(1) }
                }
            }
            listener.start(queue: .main)
            self.listener = listener
        } catch {
            status("Couldn't listen on port \(port): \(error)")
            if managed { exit(1) }
        }
    }

    private func accept(_ connection: NWConnection) {
        let key = ObjectIdentifier(connection)
        connections[key] = connection
        connection.stateUpdateHandler = { [weak self] state in
            switch state {
            case .ready:
                if managed {
                    self?.send(connection, ["type": "status", "message": self?.currentStatus ?? "Starting..."])
                } else {
                    Task { if await self?.transcriber.isReady == true { self?.send(connection, ["type": "ready"]) } }
                }
            case .failed, .cancelled:
                self?.connections[key] = nil
            default: break
            }
        }
        connection.start(queue: .main)
        receive(on: connection)
    }

    private func receive(on connection: NWConnection) {
        connection.receiveMessage { [weak self] data, context, _, error in
            guard let self, error == nil else { return connection.cancel() }
            let metadata = context?.protocolMetadata(definition: NWProtocolWebSocket.definition) as? NWProtocolWebSocket.Metadata
            if metadata?.opcode == .binary, let data, data.count > 4 { self.handle(clip: data, from: connection) }
            if metadata?.opcode == .text, let data { self.handle(text: data, from: connection) }
            self.receive(on: connection)
        }
    }

    private func handle(text: Data, from connection: NWConnection) {
        guard let message = try? JSONSerialization.jsonObject(with: text) as? [String: Any],
            message["type"] as? String == "vocabulary", let words = message["terms"] as? [String]
        else { return }
        if managed {
            if prepared { send(connection, ["type": "ready"]); return }
            guard loadingTask == nil else { return }
            loadingTask = Task {
                do {
                    status("Downloading or loading speech model. First setup needs internet...")
                    try await transcriber.load { [weak self] progress in
                        self?.status(progressText("speech model", progress))
                    }
                    status("Loading scripture vocabulary model...")
                    _ = try await transcriber.setVocabulary(words) { [weak self] progress in
                        self?.status(progressText("vocabulary model", progress))
                    }
                    DispatchQueue.main.async {
                        self.prepared = true
                        self.status("Voice ready")
                        self.connections.values.forEach { self.send($0, ["type": "ready"]) }
                    }
                } catch {
                    DispatchQueue.main.async {
                        let message = "Voice setup failed: \(error.localizedDescription). Turn voice off and on to retry."
                        self.status(message)
                        self.connections.values.forEach {
                            self.send($0, ["type": "error", "id": -1, "message": message])
                        }
                        self.loadingTask = nil
                    }
                }
            }
            return
        }
        Task {
            do {
                let count = try await transcriber.setVocabulary(words)
                onStatus("Ready · \(count) dictionary words")
                send(connection, ["type": "vocabulary", "count": count])
            } catch {
                onStatus("Ready · dictionary failed: \(error.localizedDescription)")
            }
        }
    }

    private func handle(clip: Data, from connection: NWConnection) {
        let id = clip.withUnsafeBytes { $0.loadUnaligned(as: UInt32.self) }
        let samples: [Float] = clip.dropFirst(4).withUnsafeBytes { raw in
            (0..<raw.count / 4).map { raw.loadUnaligned(fromByteOffset: $0 * 4, as: Float.self) }
        }
        Task {
            let startedAt = Date()
            do {
                let text = try await transcriber.transcribe(samples)
                let ms = Int(Date().timeIntervalSince(startedAt) * 1000)
                send(connection, ["type": "result", "id": id, "text": text, "ms": ms])
            } catch {
                send(connection, ["type": "error", "id": id, "message": error.localizedDescription])
            }
        }
    }

    private func send(_ connection: NWConnection, _ message: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: message) else { return }
        let metadata = NWProtocolWebSocket.Metadata(opcode: .text)
        let context = NWConnection.ContentContext(identifier: "message", metadata: [metadata])
        connection.send(content: data, contentContext: context, completion: .idempotent)
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    let server = Server()
    var statusItem: NSStatusItem!
    let statusLine = NSMenuItem(title: "Starting…", action: nil, keyEquivalent: "")

    func applicationDidFinishLaunching(_ notification: Notification) {
        if !managed {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem.button?.image = NSImage(systemSymbolName: "waveform", accessibilityDescription: "FlowCast Voice")
        let menu = NSMenu()
        menu.addItem(NSMenuItem(title: "FlowCast Voice", action: nil, keyEquivalent: ""))
        menu.addItem(statusLine)
        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: "Quit", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        statusItem.menu = menu
        }

        server.onStatus = { [weak self] status in
            if managed { emit(["type": "status", "message": status]) } else { print(status) }
            DispatchQueue.main.async { self?.statusLine.title = status }
        }
        server.start()
    }
}

setvbuf(stdout, nil, _IOLBF, 0)
if managed && (voiceToken.isEmpty || voiceOrigin.isEmpty) {
    fputs("Managed mode requires an authentication token and origin.\n", stderr)
    exit(1)
}
let parentPID = getppid()
let parentWatch = DispatchSource.makeTimerSource(queue: .main)
if managed {
    parentWatch.schedule(deadline: .now() + 1, repeating: 1)
    parentWatch.setEventHandler { if getppid() != parentPID { exit(0) } }
    parentWatch.resume()
}
let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory) // menu bar only, no Dock icon
app.run()
