import Foundation
import WatchConnectivity
import WatchKit

@MainActor
final class WatchSessionManager: NSObject, ObservableObject, WCSessionDelegate {
    @Published private(set) var state = TimerWatchState.idle
    @Published private(set) var isPhoneReachable = false

    private var lastCue: String?

    override init() {
        super.init()
        activateSession()
    }

    func activateSession() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    func sendCommand(_ command: WatchTimerCommand) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        let payload = ["command": command.rawValue]
        if session.isReachable {
            session.sendMessage(payload, replyHandler: nil, errorHandler: nil)
        } else {
            session.transferUserInfo(payload)
        }
    }

    nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        Task { @MainActor in
            isPhoneReachable = session.isReachable
            let context = session.receivedApplicationContext
            if !context.isEmpty {
                applyState(context)
            }
        }
    }

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        Task { @MainActor in
            isPhoneReachable = session.isReachable
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        Task { @MainActor in
            applyState(applicationContext)
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        Task { @MainActor in
            applyState(message)
        }
    }

    private func applyState(_ dictionary: [String: Any]) {
        let next = TimerWatchState.from(dictionary: dictionary)
        state = next

        if let cue = next.cue, cue != lastCue, next.vibrateEnabled {
            lastCue = cue
            playCue(cue)
        }

        if next.cue == nil {
            lastCue = nil
        }
    }

    private func playCue(_ cue: String) {
        let device = WKInterfaceDevice.current()
        switch cue {
        case "done":
            device.play(.success)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                device.play(.notification)
            }
        case "switch", "setRest":
            device.play(.notification)
        default:
            device.play(.click)
        }
    }
}
