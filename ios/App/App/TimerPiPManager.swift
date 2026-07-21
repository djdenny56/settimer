import AVFoundation
import AVKit
import CoreMedia
import CoreVideo
import UIKit

struct PiPPhase {
    let label: String
    let durationSec: Double
    let subline: String
}

final class SampleBufferDisplayView: UIView {
    override class var layerClass: AnyClass { AVSampleBufferDisplayLayer.self }

    var sampleBufferDisplayLayer: AVSampleBufferDisplayLayer {
        layer as! AVSampleBufferDisplayLayer
    }
}

/// Keeps an active playback audio session while the timer runs so PiP can start.
final class PiPAudioKeepAlive {
    private var player: AVAudioPlayer?

    func start() {
        guard player?.isPlaying != true else { return }
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playback, mode: .moviePlayback, options: [.mixWithOthers])
            try session.setActive(true)
        } catch {
            return
        }

        guard let url = Bundle.main.url(forResource: "pip-silence", withExtension: "wav") else { return }
        do {
            let audioPlayer = try AVAudioPlayer(contentsOf: url)
            audioPlayer.numberOfLoops = -1
            audioPlayer.volume = 0.01
            audioPlayer.prepareToPlay()
            audioPlayer.play()
            player = audioPlayer
        } catch {
            player = nil
        }
    }

    func stop() {
        player?.stop()
        player = nil
    }
}

final class TimerPiPManager: NSObject {
    static let shared = TimerPiPManager()

    private var pipController: AVPictureInPictureController?
    private let displayView = SampleBufferDisplayView()
    private let audioKeepAlive = PiPAudioKeepAlive()
    private var displayTimer: Timer?
    private var configured = false
    private var frameCount: Int64 = 0
    private var startAttempts = 0
    private let frameSize = CGSize(width: 640, height: 360)
    private let timeScale: CMTimeScale = 600

    private var enabled = true
    private var running = false
    private var paused = false
    private var done = false
    private var showMs = true
    private var syncedIdx = 0
    private var phaseStartAtMs: Double = 0
    private var phases: [PiPPhase] = []
    private var tileColor = UIColor(red: 0.16, green: 0.10, blue: 0.29, alpha: 1)

    private override init() {
        super.init()
    }

    func isSupported() -> Bool {
        AVPictureInPictureController.isPictureInPictureSupported()
    }

    func prepareForWorkout() {
        ensureConfigured()
        guard enabled else { return }
        audioKeepAlive.start()
        primeFrames()
        startFramePumpIfNeeded()
    }

    func updateState(_ payload: [String: Any]) {
        enabled = payload["enabled"] as? Bool ?? true
        running = payload["running"] as? Bool ?? false
        paused = payload["paused"] as? Bool ?? false
        done = payload["done"] as? Bool ?? false
        showMs = payload["showMs"] as? Bool ?? true
        syncedIdx = payload["idx"] as? Int ?? 0
        phaseStartAtMs = Self.number(from: payload["phaseStartAtMs"]) ?? 0

        if let hex = payload["tileBg"] as? String, let color = Self.color(fromHex: hex) {
            tileColor = color
            displayView.sampleBufferDisplayLayer.backgroundColor = color.cgColor
        }

        if let rawPhases = payload["phases"] as? [[String: Any]] {
            phases = rawPhases.compactMap { item in
                guard
                    let label = item["label"] as? String,
                    let subline = item["subline"] as? String
                else { return nil }
                let duration = Self.number(from: item["durationSec"]) ?? 0
                guard duration > 0 else { return nil }
                return PiPPhase(label: label, durationSec: duration, subline: subline)
            }
        }

        ensureConfigured()

        if running && !paused && !done && enabled {
            audioKeepAlive.start()
            primeFrames()
            startFramePumpIfNeeded()
        } else if !running || done {
            audioKeepAlive.stop()
            if pipController?.isPictureInPictureActive != true {
                stopFramePump()
            }
        }

        pipController?.invalidatePlaybackState()
    }

    func startIfNeeded() {
        guard enabled, running, !paused, !done, phaseStartAtMs > 0 else { return }
        ensureConfigured()
        guard pipController != nil else { return }

        audioKeepAlive.start()
        startAttempts = 0
        attemptStartPiP()
    }

    func stop() {
        startAttempts = 0
        stopFramePump()
        audioKeepAlive.stop()
        pipController?.stopPictureInPicture()
    }

    private func ensureConfigured() {
        guard !configured else { return }
        guard let parentView = hostView() else { return }
        configured = true

        let width: CGFloat = 120
        let height: CGFloat = 68
        displayView.frame = CGRect(
            x: 12,
            y: parentView.bounds.height - height - 12,
            width: width,
            height: height
        )
        displayView.autoresizingMask = [.flexibleTopMargin, .flexibleRightMargin]
        displayView.isUserInteractionEnabled = false
        displayView.alpha = 0.02
        displayView.clipsToBounds = true
        parentView.addSubview(displayView)

        let displayLayer = displayView.sampleBufferDisplayLayer
        displayLayer.videoGravity = .resizeAspectFill
        displayLayer.backgroundColor = tileColor.cgColor
        displayLayer.frame = displayView.bounds

        let source = AVPictureInPictureController.ContentSource(
            sampleBufferDisplayLayer: displayLayer,
            playbackDelegate: self
        )
        pipController = AVPictureInPictureController(contentSource: source)
        pipController?.delegate = self
        pipController?.canStartPictureInPictureAutomaticallyFromInline = true
        pipController?.requiresLinearPlayback = true
    }

    private func hostView() -> UIView? {
        if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let view = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController?.view {
            return view
        }
        return nil
    }

    private func attemptStartPiP() {
        guard enabled, running, !paused, !done, phaseStartAtMs > 0 else { return }
        guard let pip = pipController else { return }

        prepareAudioSessionForPiP()
        primeFrames()
        startFramePumpIfNeeded()
        pip.invalidatePlaybackState()

        if pip.isPictureInPictureActive {
            return
        }

        if pip.isPictureInPicturePossible {
            pip.startPictureInPicture()
            return
        }

        startAttempts += 1
        guard startAttempts <= 12 else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) { [weak self] in
            self?.attemptStartPiP()
        }
    }

    private func prepareAudioSessionForPiP() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playback, mode: .moviePlayback, options: [.mixWithOthers])
            try session.setActive(true)
        } catch {
            // ignore
        }
    }

    private func primeFrames() {
        for _ in 0..<6 {
            enqueueFrame()
        }
    }

    private func startFramePumpIfNeeded() {
        guard running && !paused && !done else { return }
        guard displayTimer == nil else { return }

        let timer = Timer(timeInterval: 0.1, repeats: true) { [weak self] _ in
            self?.enqueueFrame()
        }
        RunLoop.main.add(timer, forMode: .common)
        displayTimer = timer
    }

    private func stopFramePump() {
        displayTimer?.invalidate()
        displayTimer = nil
    }

    private func enqueueFrame() {
        let snapshot = currentSnapshot()
        guard
            let image = renderFrame(snapshot),
            let pixelBuffer = image.pixelBuffer(size: frameSize),
            let sampleBuffer = makeSampleBuffer(from: pixelBuffer)
        else { return }

        let layer = displayView.sampleBufferDisplayLayer
        if layer.status == .failed {
            layer.flush()
        }
        if layer.controlTimebase == nil {
            var timebase: CMTimebase?
            CMTimebaseCreateWithSourceClock(allocator: kCFAllocatorDefault, sourceClock: CMClockGetHostTimeClock(), timebaseOut: &timebase)
            if let timebase {
                CMTimebaseSetTime(timebase, time: .zero)
                CMTimebaseSetRate(timebase, rate: 1.0)
                layer.controlTimebase = timebase
            }
        }
        layer.enqueue(sampleBuffer)
        frameCount += 1
        pipController?.invalidatePlaybackState()
    }

    private struct FrameSnapshot {
        let phase: String
        let time: String
        let subline: String
        let progress: Float
    }

    private func currentSnapshot() -> FrameSnapshot {
        if done {
            return FrameSnapshot(phase: "Done", time: "0", subline: "Workout complete", progress: 0)
        }
        if !running || paused {
            return FrameSnapshot(
                phase: paused ? "Paused" : "Ready",
                time: "--",
                subline: "",
                progress: 0
            )
        }

        let nowMs = Date().timeIntervalSince1970 * 1000
        let state = computeState(at: nowMs)
        if state.done {
            return FrameSnapshot(phase: "Done", time: "0", subline: "Workout complete", progress: 0)
        }
        guard let phase = state.phase else {
            return FrameSnapshot(phase: "Timer", time: "--", subline: "", progress: 0)
        }

        let duration = max(phase.durationSec, 0.001)
        let progress = Float(max(0, min(1, state.remaining / duration)))
        return FrameSnapshot(
            phase: phase.label,
            time: formatTime(state.remaining),
            subline: phase.subline,
            progress: progress
        )
    }

    private func renderFrame(_ snapshot: FrameSnapshot) -> UIImage? {
        let size = frameSize
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = true
        let renderer = UIGraphicsImageRenderer(size: size, format: format)
        return renderer.image { context in
            let rect = CGRect(origin: .zero, size: size)
            tileColor.setFill()
            context.fill(rect)

            let phaseAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 28, weight: .heavy),
                .foregroundColor: UIColor.white.withAlphaComponent(0.92),
            ]
            let timeAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.monospacedDigitSystemFont(ofSize: 120, weight: .black),
                .foregroundColor: UIColor.white,
            ]
            let sublineAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 24, weight: .bold),
                .foregroundColor: UIColor.white.withAlphaComponent(0.85),
            ]

            let phaseText = snapshot.phase.uppercased() as NSString
            let timeText = snapshot.time as NSString
            let sublineText = snapshot.subline as NSString

            let phaseSize = phaseText.size(withAttributes: phaseAttrs)
            let timeSize = timeText.size(withAttributes: timeAttrs)
            let sublineSize = sublineText.size(withAttributes: sublineAttrs)

            let progressHeight: CGFloat = 10
            let stackHeight = phaseSize.height + 12 + timeSize.height + 10 + sublineSize.height + 18 + progressHeight
            var y = (size.height - stackHeight) / 2

            phaseText.draw(
                at: CGPoint(x: (size.width - phaseSize.width) / 2, y: y),
                withAttributes: phaseAttrs
            )
            y += phaseSize.height + 12

            timeText.draw(
                at: CGPoint(x: (size.width - timeSize.width) / 2, y: y),
                withAttributes: timeAttrs
            )
            y += timeSize.height + 10

            sublineText.draw(
                at: CGPoint(x: (size.width - sublineSize.width) / 2, y: y),
                withAttributes: sublineAttrs
            )
            y += sublineSize.height + 18

            let barRect = CGRect(x: 48, y: y, width: size.width - 96, height: progressHeight)
            UIColor.white.withAlphaComponent(0.2).setFill()
            context.fill(barRect)

            let fillRect = CGRect(
                x: barRect.minX,
                y: barRect.minY,
                width: barRect.width * CGFloat(snapshot.progress),
                height: barRect.height
            )
            UIColor(red: 0.99, green: 0.75, blue: 0.18, alpha: 1).setFill()
            context.fill(fillRect)
        }
    }

    private func makeSampleBuffer(from pixelBuffer: CVPixelBuffer) -> CMSampleBuffer? {
        var formatDescription: CMFormatDescription?
        CMVideoFormatDescriptionCreateForImageBuffer(
            allocator: kCFAllocatorDefault,
            imageBuffer: pixelBuffer,
            formatDescriptionOut: &formatDescription
        )
        guard let formatDescription else { return nil }

        var timing = CMSampleTimingInfo(
            duration: CMTime(value: 1, timescale: 10),
            presentationTimeStamp: CMTime(value: frameCount, timescale: timeScale),
            decodeTimeStamp: .invalid
        )

        var sampleBuffer: CMSampleBuffer?
        CMSampleBufferCreateForImageBuffer(
            allocator: kCFAllocatorDefault,
            imageBuffer: pixelBuffer,
            dataReady: true,
            makeDataReadyCallback: nil,
            refcon: nil,
            formatDescription: formatDescription,
            sampleTiming: &timing,
            sampleBufferOut: &sampleBuffer
        )

        if let sampleBuffer,
           let attachments = CMSampleBufferGetSampleAttachmentsArray(sampleBuffer, createIfNecessary: true) as? [CFMutableDictionary],
           let attachment = attachments.first {
            CFDictionarySetValue(
                attachment,
                Unmanaged.passUnretained(kCMSampleAttachmentKey_DisplayImmediately).toOpaque(),
                Unmanaged.passUnretained(kCFBooleanTrue).toOpaque()
            )
        }

        return sampleBuffer
    }

    private func computeState(at nowMs: Double) -> (phase: PiPPhase?, remaining: Double, done: Bool) {
        guard !phases.isEmpty, phaseStartAtMs > 0 else {
            return (nil, 0, false)
        }

        var phaseStart = phaseStartAtMs
        var i = syncedIdx

        while i < phases.count {
            let phase = phases[i]
            let phaseEnd = phaseStart + phase.durationSec * 1000
            if nowMs < phaseEnd {
                return (phase, (phaseEnd - nowMs) / 1000, false)
            }
            phaseStart = phaseEnd
            i += 1
        }

        return (nil, 0, true)
    }

    private func formatTime(_ remainingSec: Double) -> String {
        let clamped = max(0, remainingSec)
        let seconds = Int(clamped)
        if showMs {
            let tenths = Int((clamped - Double(seconds)) * 10)
            return "\(seconds).\(tenths)"
        }
        return seconds > 0 ? "\(seconds)" : "0"
    }

    private static func number(from value: Any?) -> Double? {
        if let number = value as? NSNumber { return number.doubleValue }
        if let double = value as? Double { return double }
        if let int = value as? Int { return Double(int) }
        return nil
    }

    private static func color(fromHex hex: String) -> UIColor? {
        var cleaned = hex.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        if cleaned.hasPrefix("#") { cleaned.removeFirst() }
        guard cleaned.count == 6, let value = UInt64(cleaned, radix: 16) else { return nil }
        let r = CGFloat((value >> 16) & 0xFF) / 255
        let g = CGFloat((value >> 8) & 0xFF) / 255
        let b = CGFloat(value & 0xFF) / 255
        return UIColor(red: r, green: g, blue: b, alpha: 1)
    }
}

extension TimerPiPManager: AVPictureInPictureControllerDelegate {
    func pictureInPictureControllerDidStartPictureInPicture(_ pictureInPictureController: AVPictureInPictureController) {
        startFramePumpIfNeeded()
    }

    func pictureInPictureControllerDidStopPictureInPicture(_ pictureInPictureController: AVPictureInPictureController) {
        if !running || done {
            stopFramePump()
            audioKeepAlive.stop()
        }
    }

    func pictureInPictureController(
        _ pictureInPictureController: AVPictureInPictureController,
        failedToStartPictureInPictureWithError error: Error
    ) {
        if startAttempts <= 12 {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { [weak self] in
                self?.attemptStartPiP()
            }
        }
    }
}

extension TimerPiPManager: AVPictureInPictureSampleBufferPlaybackDelegate {
    func pictureInPictureController(
        _ pictureInPictureController: AVPictureInPictureController,
        setPlaying playing: Bool
    ) {}

    func pictureInPictureControllerTimeRangeForPlayback(
        _ pictureInPictureController: AVPictureInPictureController
    ) -> CMTimeRange {
        CMTimeRange(start: .zero, duration: .positiveInfinity)
    }

    func pictureInPictureControllerIsPlaybackPaused(
        _ pictureInPictureController: AVPictureInPictureController
    ) -> Bool {
        false
    }

    func pictureInPictureController(
        _ pictureInPictureController: AVPictureInPictureController,
        skipByInterval skipInterval: CMTime,
        completion completionHandler: @escaping () -> Void
    ) {
        completionHandler()
    }

    func pictureInPictureController(
        _ pictureInPictureController: AVPictureInPictureController,
        didTransitionToRenderSize newRenderSize: CMVideoDimensions
    ) {}
}

private extension UIImage {
    func pixelBuffer(size: CGSize) -> CVPixelBuffer? {
        let width = Int(size.width)
        let height = Int(size.height)
        var pixelBuffer: CVPixelBuffer?
        let attrs: [CFString: Any] = [
            kCVPixelBufferCGImageCompatibilityKey: true,
            kCVPixelBufferCGBitmapContextCompatibilityKey: true,
        ]
        let status = CVPixelBufferCreate(
            kCFAllocatorDefault,
            width,
            height,
            kCVPixelFormatType_32BGRA,
            attrs as CFDictionary,
            &pixelBuffer
        )
        guard status == kCVReturnSuccess, let buffer = pixelBuffer else { return nil }

        CVPixelBufferLockBaseAddress(buffer, [])
        defer { CVPixelBufferUnlockBaseAddress(buffer, []) }

        guard let context = CGContext(
            data: CVPixelBufferGetBaseAddress(buffer),
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
        ), let cgImage else { return nil }

        context.clear(CGRect(x: 0, y: 0, width: width, height: height))
        context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
        return buffer
    }
}
