import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var session: WatchSessionManager
    @State private var displayRemaining: Double = 0

    private let tick = Timer.publish(every: 0.1, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(spacing: 8) {
            Text(session.state.title)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)

            Text(session.state.phaseLabel.uppercased())
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(.orange)

            Text(formatRemaining(displayRemaining))
                .font(.system(size: 42, weight: .black, design: .rounded))
                .monospacedDigit()
                .minimumScaleFactor(0.6)
                .lineLimit(1)

            Text(session.state.subline)
                .font(.caption2)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .lineLimit(2)

            if session.state.running && !session.state.done {
                HStack(spacing: 10) {
                    Button(session.state.paused ? "Resume" : "Pause") {
                        session.sendCommand(session.state.paused ? .resume : .pause)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(session.state.paused ? .green : .orange)

                    Button("Skip") {
                        session.sendCommand(.skip)
                    }
                    .buttonStyle(.bordered)
                }
                .padding(.top, 4)
            } else if session.state.done {
                Text("Done")
                    .font(.headline)
                    .foregroundStyle(.green)
            } else {
                Text(session.isPhoneReachable ? "Waiting for iPhone" : "Open SetTimer on iPhone")
                    .font(.caption2)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 6)
        .onReceive(tick) { _ in
            displayRemaining = session.state.liveRemaining()
        }
        .onChange(of: session.state) { _, newValue in
            displayRemaining = newValue.liveRemaining()
        }
        .onAppear {
            displayRemaining = session.state.liveRemaining()
        }
    }

    private func formatRemaining(_ value: Double) -> String {
        let total = max(0, Int(ceil(value)))
        let minutes = total / 60
        let seconds = total % 60
        if minutes > 0 {
            return String(format: "%d:%02d", minutes, seconds)
        }
        return String(format: "0:%02d", seconds)
    }
}

#Preview {
    ContentView()
        .environmentObject(WatchSessionManager())
}
