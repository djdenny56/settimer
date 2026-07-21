import Foundation
import WatchConnectivity

final class PhoneWatchSession: NSObject, WCSessionDelegate {
    static let shared = PhoneWatchSession()

    var commandHandler: ((String) -> Void)?

    private override init() {
        super.init()
    }

    func activate() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    func sendTimerState(_ payload: [String: Any]) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated else { return }

        do {
            try session.updateApplicationContext(payload)
        } catch {
            // Fall back to live messaging when context update fails.
            if session.isReachable {
                session.sendMessage(payload, replyHandler: nil, errorHandler: nil)
            }
        }
    }

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}

    func sessionDidBecomeInactive(_ session: WCSession) {}

    func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        handleCommandMessage(message)
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        handleCommandMessage(message)
        replyHandler(["ok": true])
    }

    private func handleCommandMessage(_ message: [String: Any]) {
        guard let command = message["command"] as? String else { return }
        DispatchQueue.main.async { [weak self] in
            self?.commandHandler?(command)
        }
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        handleCommandMessage(userInfo)
    }
}
