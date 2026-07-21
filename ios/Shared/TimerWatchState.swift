import Foundation

struct TimerWatchState: Codable, Equatable {
    var running: Bool
    var paused: Bool
    var done: Bool
    var remainingSec: Double
    var phaseEndAtMs: Double?
    var phaseLabel: String
    var subline: String
    var title: String
    var vibrateEnabled: Bool
    var cue: String?

    static let idle = TimerWatchState(
        running: false,
        paused: false,
        done: false,
        remainingSec: 0,
        phaseEndAtMs: nil,
        phaseLabel: "Ready",
        subline: "Start a timer on iPhone",
        title: "SetTimer",
        vibrateEnabled: true,
        cue: nil
    )

    func dictionary() -> [String: Any] {
        var dict: [String: Any] = [
            "running": running,
            "paused": paused,
            "done": done,
            "remainingSec": remainingSec,
            "phaseLabel": phaseLabel,
            "subline": subline,
            "title": title,
            "vibrateEnabled": vibrateEnabled,
        ]
        if let phaseEndAtMs {
            dict["phaseEndAtMs"] = phaseEndAtMs
        }
        if let cue {
            dict["cue"] = cue
        }
        return dict
    }

    static func from(dictionary: [String: Any]) -> TimerWatchState {
        TimerWatchState(
            running: dictionary["running"] as? Bool ?? false,
            paused: dictionary["paused"] as? Bool ?? false,
            done: dictionary["done"] as? Bool ?? false,
            remainingSec: dictionary["remainingSec"] as? Double ?? 0,
            phaseEndAtMs: dictionary["phaseEndAtMs"] as? Double,
            phaseLabel: dictionary["phaseLabel"] as? String ?? "Ready",
            subline: dictionary["subline"] as? String ?? "",
            title: dictionary["title"] as? String ?? "SetTimer",
            vibrateEnabled: dictionary["vibrateEnabled"] as? Bool ?? true,
            cue: dictionary["cue"] as? String
        )
    }

    func liveRemaining(at nowMs: Double = Date().timeIntervalSince1970 * 1000) -> Double {
        guard running, !paused, !done, let phaseEndAtMs else { return remainingSec }
        return max(0, (phaseEndAtMs - nowMs) / 1000)
    }
}

enum WatchTimerCommand: String {
    case pause
    case resume
    case skip
}
