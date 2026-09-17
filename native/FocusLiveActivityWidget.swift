import ActivityKit
import SwiftUI
import WidgetKit

// Keep this in step with modules/expo-focus-live-activity/ios/ExpoFocusLiveActivityModule.swift
// and with FocusLiveActivityState in modules/expo-focus-live-activity/index.ts.
// All three describe the same payload; if they drift, the activity stops decoding.
struct GoalsFocusTimerAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    /// "focus" for a timed session, "visit" for an Auto Check-In.
    let kind: String
    let goalName: String
    let modeLabel: String
    let phaseLabel: String
    let isBreak: Bool
    let isRunning: Bool
    let timerCountsUp: Bool
    let timerDate: Date
    let staticTime: String
    /// What is growing on the island right now; empty when nothing is.
    let growName: String
    let growDetail: String
    /// plant | building | water | beach — picks the symbol next to the name.
    let growCategory: String
  }

  let sessionId: String
  let goalId: String
}

/**
 The app's own paper look, not a generic dark widget.

 The lock screen is usually dark, so a warm off-white card with the island green
 reads as this app at a glance instead of as one more system banner.
 */
private enum GoalsActivityStyle {
  static let page = Color(red: 0.961, green: 0.961, blue: 0.949)
  static let ink = Color(red: 0.098, green: 0.102, blue: 0.090)
  static let inkMuted = Color(red: 0.420, green: 0.420, blue: 0.392)
  static let accent = Color(red: 0.180, green: 0.620, blue: 0.310)
  static let accentInk = Color(red: 0.122, green: 0.478, blue: 0.235)
  static let accentWash = Color(red: 0.922, green: 0.957, blue: 0.929)
}

private extension GoalsFocusTimerAttributes.ContentState {
  var isVisit: Bool { kind == "visit" }
  var isFlowtime: Bool { modeLabel == "FLOWTIME" }
  var hasGrowth: Bool { !growName.isEmpty }

  var growSymbol: String {
    switch growCategory {
    case "building": return "house.fill"
    case "water": return "drop.fill"
    case "beach": return "beach.umbrella.fill"
    default: return "leaf.fill"
    }
  }

  var modeSymbol: String {
    if isVisit { return "mappin.and.ellipse" }
    return isFlowtime ? "infinity" : "timer"
  }

  var shortMode: String {
    if isVisit { return "HERE" }
    return isFlowtime ? "FLOW" : "INT"
  }

  /// One honest line about what the timer is doing.
  var statusLine: String {
    if isVisit { return "Checked in" }
    if isFlowtime { return isBreak ? "Recovery is running" : "Focus time is running" }
    return isRunning ? "Timer is running" : "Timer is paused"
  }
}

private extension GoalsFocusTimerAttributes {
  var openURL: URL {
    URL(string: "com.goals.app://focus?goalId=\(goalId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? goalId)")!
  }

  func actionURL(_ action: String) -> URL {
    URL(
      string: "com.goals.app://focus?goalId=\(goalId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? goalId)&action=\(action)"
    )!
  }
}

/// The banner sits on the app's paper, the Dynamic Island on black — so the
/// colour is passed in rather than baked into the timer.
private struct ActivityTimerText: View {
  let state: GoalsFocusTimerAttributes.ContentState
  let fontSize: CGFloat
  let bold: Bool
  var tint: Color = GoalsActivityStyle.ink

  var body: some View {
    Group {
      if state.isRunning {
        Text(state.timerDate, style: .timer)
      } else {
        Text(state.staticTime)
      }
    }
    .font(.system(size: fontSize, weight: bold ? .bold : .semibold, design: .rounded))
    .monospacedDigit()
    .foregroundStyle(tint)
    .lineLimit(1)
    .minimumScaleFactor(0.78)
  }
}

private struct ActivityModeLabel: View {
  let state: GoalsFocusTimerAttributes.ContentState
  let abbreviated: Bool
  var tint: Color = GoalsActivityStyle.accentInk

  var body: some View {
    HStack(spacing: abbreviated ? 3 : 5) {
      Image(systemName: state.modeSymbol)
      Text(abbreviated ? state.shortMode : state.modeLabel)
    }
    .font(.system(size: abbreviated ? 10 : 12, weight: .bold, design: .rounded))
    .foregroundStyle(tint)
    .lineLimit(1)
    .minimumScaleFactor(0.82)
  }
}

/// What this session is growing on the island — the reason the timer is running.
private struct ActivityGrowLine: View {
  let state: GoalsFocusTimerAttributes.ContentState
  let compact: Bool

  var body: some View {
    HStack(spacing: 6) {
      Image(systemName: state.growSymbol)
        .font(.system(size: compact ? 10 : 12, weight: .semibold))
        .foregroundStyle(GoalsActivityStyle.accent)
      Text(state.growDetail.isEmpty ? state.growName : "\(state.growName) · \(state.growDetail)")
        .font(.system(size: compact ? 11 : 13, weight: .medium, design: .rounded))
        .foregroundStyle(GoalsActivityStyle.inkMuted)
        .lineLimit(1)
        .minimumScaleFactor(0.8)
    }
  }
}

private struct ActivityActionLink: View {
  let title: String
  let systemImage: String
  let destination: URL
  let prominent: Bool

  var body: some View {
    Link(destination: destination) {
      Label(title, systemImage: systemImage)
        .font(.system(size: 13, weight: .semibold, design: .rounded))
        .lineLimit(1)
        .frame(maxWidth: .infinity, minHeight: 36)
        .foregroundStyle(prominent ? Color.white : GoalsActivityStyle.accentInk)
        .background(
          prominent ? GoalsActivityStyle.accent : GoalsActivityStyle.accentWash,
          in: Capsule()
        )
    }
  }
}

/// A visit has nothing to pause — it ends when you leave.
private struct ActivityActions: View {
  let context: ActivityViewContext<GoalsFocusTimerAttributes>

  var body: some View {
    if context.state.isVisit {
      EmptyView()
    } else if context.state.isFlowtime {
      ActivityActionLink(
        title: context.state.isBreak ? "Resume Focus" : "Take Break",
        systemImage: context.state.isBreak ? "book.fill" : "cup.and.saucer.fill",
        destination: context.attributes.actionURL("toggle-break"),
        prominent: true
      )
    } else {
      HStack(spacing: 10) {
        ActivityActionLink(
          title: context.state.isRunning ? "Pause" : "Resume",
          systemImage: context.state.isRunning ? "pause.fill" : "play.fill",
          destination: context.attributes.actionURL("toggle-pause"),
          prominent: true
        )
        ActivityActionLink(
          title: context.state.isBreak ? "Focus" : "Break",
          systemImage: context.state.isBreak ? "book.fill" : "cup.and.saucer.fill",
          destination: context.attributes.actionURL("toggle-break"),
          prominent: false
        )
      }
    }
  }
}

private struct FocusActivityBanner: View {
  let context: ActivityViewContext<GoalsFocusTimerAttributes>

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack(spacing: 8) {
        ActivityModeLabel(state: context.state, abbreviated: false)
        Spacer()
        Text(context.state.phaseLabel)
          .font(.system(size: 12, weight: .semibold, design: .rounded))
          .foregroundStyle(GoalsActivityStyle.inkMuted)
      }

      HStack(alignment: .center, spacing: 12) {
        VStack(alignment: .leading, spacing: 3) {
          Text(context.state.goalName)
            .font(.system(size: 18, weight: .bold, design: .rounded))
            .foregroundStyle(GoalsActivityStyle.ink)
            .lineLimit(1)
          Text(context.state.statusLine)
            .font(.system(size: 13, weight: .medium, design: .rounded))
            .foregroundStyle(GoalsActivityStyle.inkMuted)
        }
        Spacer(minLength: 8)
        ActivityTimerText(state: context.state, fontSize: 30, bold: true)
      }

      if context.state.hasGrowth {
        ActivityGrowLine(state: context.state, compact: false)
      }

      ActivityActions(context: context)
    }
    .padding(16)
    .activityBackgroundTint(GoalsActivityStyle.page)
    .activitySystemActionForegroundColor(GoalsActivityStyle.accentInk)
    .widgetURL(context.attributes.openURL)
  }
}

struct GoalsFocusTimerLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: GoalsFocusTimerAttributes.self) { context in
      FocusActivityBanner(context: context)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          VStack(alignment: .leading, spacing: 3) {
            // On the black island the green has to be the lighter one.
            ActivityModeLabel(
              state: context.state,
              abbreviated: false,
              tint: GoalsActivityStyle.accent
            )
            Text(context.state.phaseLabel)
              .font(.system(size: 10, weight: .medium, design: .rounded))
              .foregroundStyle(.secondary)
              .lineLimit(1)
          }
          .padding(.top, 5)
        }

        DynamicIslandExpandedRegion(.trailing) {
          ActivityTimerText(state: context.state, fontSize: 20, bold: true, tint: .white)
            .frame(minWidth: 66, alignment: .trailing)
            .padding(.top, 5)
        }

        DynamicIslandExpandedRegion(.center) {
          VStack(spacing: 2) {
            Text(context.state.goalName)
              .font(.system(size: 16, weight: .bold, design: .rounded))
              .lineLimit(1)
            if context.state.hasGrowth {
              Text(context.state.growName)
                .font(.system(size: 11, weight: .medium, design: .rounded))
                .foregroundStyle(.secondary)
                .lineLimit(1)
            }
          }
        }

        DynamicIslandExpandedRegion(.bottom) {
          ActivityActions(context: context)
            .padding(.top, 6)
        }
      } compactLeading: {
        ActivityModeLabel(
          state: context.state,
          abbreviated: true,
          tint: GoalsActivityStyle.accent
        )
      } compactTrailing: {
        ActivityTimerText(state: context.state, fontSize: 13, bold: false, tint: .white)
      } minimal: {
        Image(systemName: context.state.modeSymbol)
          .font(.system(size: 13, weight: .semibold))
          .foregroundStyle(GoalsActivityStyle.accent)
      }
      .widgetURL(context.attributes.openURL)
      .keylineTint(GoalsActivityStyle.accent)
    }
  }
}

@main
struct GoalsWidgets: WidgetBundle {
  var body: some Widget {
    GoalsFocusTimerLiveActivity()
  }
}
