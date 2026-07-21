import Capacitor
import Foundation

@objc(TimerPiPPlugin)
public class TimerPiPPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TimerPiPPlugin"
    public let jsName = "TimerPiP"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "updateState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "prepare", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]

    public override func load() {
        DispatchQueue.main.async {
            _ = TimerPiPManager.shared.isSupported()
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
        DispatchQueue.main.async {
            TimerPiPManager.shared.updateState(payload)
            call.resolve()
        }
    }

    @objc public func prepare(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            TimerPiPManager.shared.prepareForWorkout()
            call.resolve()
        }
    }

    @objc public func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            TimerPiPManager.shared.startIfNeeded()
            call.resolve()
        }
    }

    @objc public func isSupported(_ call: CAPPluginCall) {
        call.resolve(["supported": TimerPiPManager.shared.isSupported()])
    }

    @objc public func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            TimerPiPManager.shared.stop()
            call.resolve()
        }
    }
}
