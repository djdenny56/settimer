import Capacitor
import Foundation

@objc(WatchSyncPlugin)
public class WatchSyncPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WatchSyncPlugin"
    public let jsName = "WatchSync"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "updateState", returnType: CAPPluginReturnPromise),
    ]

    public override func load() {
        PhoneWatchSession.shared.commandHandler = { [weak self] command in
            self?.notifyListeners("watchCommand", data: ["command": command])
        }
    }

    @objc public func updateState(_ call: CAPPluginCall) {
        guard let options = call.options else {
            call.reject("Missing timer state")
            return
        }
        let payload = options.reduce(into: [String: Any]()) { result, pair in
            if let key = pair.key as? String {
                result[key] = pair.value
            }
        }
        PhoneWatchSession.shared.sendTimerState(payload)
        call.resolve()
    }
}
