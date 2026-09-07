import ActivityKit
import SwiftUI
import WidgetKit

struct GoalsFocusTimerAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    let goalName: String
    let modeLabel: String
    let phaseLabel: String
    let isBreak: Bool
    let isRunning: Bool
    let timerCountsUp: Bool
    let timerDate: Date
    let staticTime: String
  }

  let sessionId: String
  let goalId: String
}

private enum GoalsActivityStyle {
  static let accent = Color(red: 0.42, green: 0.53, blue: 0.96)
  static let secondary = Color.white.opacity(0.72)
  static let background = Color(red: 0.08, green: 0.09, blue: 0.12)
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

private struct ActivityTimerText: View {
  let state: GoalsFocusTimerAttributes.ContentState
  let fontSize: CGFloat
  let bold: Bool

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
    .foregroundStyle(.white)
    .lineLimit(1)
    .minimumScaleFactor(0.78)
  }
}

private struct ActivityModeLabel: View {
  let state: GoalsFocusTimerAttributes.ContentState
  let abbreviated: Bool

  var body: some View {
    HStack(spacing: abbreviated ? 3 : 5) {
      Image(systemName: state.modeLabel == "FLOWTIME" ? "infinity" : "timer")
      Text(
        abbreviated
          ? (state.modeLabel == "FLOWTIME" ? "FLOW" : "INT")
          : state.modeLabel
      )
    }
    .font(.system(size: abbreviated ? 10 : 12, weight: .bold, design: .rounded))
    .foregroundStyle(GoalsActivityStyle.accent)
    .lineLimit(1)
    .minimumScaleFactor(0.82)
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
        .foregroundStyle(prominent ? .white : GoalsActivityStyle.accent)
        .background(
          prominent
            ? GoalsActivityStyle.accent
            : Color.white.opacity(0.09),
          in: Capsule()
        )
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
          .foregroundStyle(GoalsActivityStyle.secondary)
      }

      HStack(alignment: .center, spacing: 12) {
        VStack(alignment: .leading, spacing: 3) {
          Text(context.state.goalName)
            .font(.system(size: 18, weight: .bold, design: .rounded))
            .foregroundStyle(.white)
            .lineLimit(1)
          Text(
            context.state.modeLabel == "FLOWTIME"
              ? (context.state.isBreak ? "Recovery is running" : "Focus time is running")
              : (context.state.isRunning ? "Timer is running" : "Timer is paused")
          )
            .font(.system(size: 13, weight: .medium, design: .rounded))
            .foregroundStyle(GoalsActivityStyle.secondary)
        }
        Spacer(minLength: 8)
        ActivityTimerText(state: context.state, fontSize: 30, bold: true)
      }

      HStack(spacing: 10) {
        if context.state.modeLabel == "FLOWTIME" {
          ActivityActionLink(
            title: context.state.isBreak ? "Resume Focus" : "Take Break",
            systemImage: context.state.isBreak ? "book.fill" : "cup.and.saucer.fill",
            destination: context.attributes.actionURL("toggle-break"),
            prominent: true
          )
        } else {
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
    .padding(16)
    .activityBackgroundTint(GoalsActivityStyle.background)
    .activitySystemActionForegroundColor(.white)
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
            Text(context.state.modeLabel == "FLOWTIME" ? "FLOW" : "INTERVAL")
              .font(.system(size: 11, weight: .bold, design: .rounded))
              .foregroundStyle(GoalsActivityStyle.accent)
              .lineLimit(1)
              .minimumScaleFactor(0.82)
            Text(context.state.phaseLabel)
              .font(.system(size: 10, weight: .medium, design: .rounded))
              .foregroundStyle(GoalsActivityStyle.secondary)
              .lineLimit(1)
          }
          .padding(.top, 5)
        }

        DynamicIslandExpandedRegion(.trailing) {
          ActivityTimerText(
            state: context.state,
            fontSize: 20,
            bold: true
          )
          .frame(minWidth: 66, alignment: .trailing)
          .padding(.top, 5)
        }

        DynamicIslandExpandedRegion(.center) {
          Text(context.state.goalName)
            .font(.system(size: 16, weight: .bold, design: .rounded))
            .foregroundStyle(.white)
            .lineLimit(1)
        }

        DynamicIslandExpandedRegion(.bottom) {
          HStack(spacing: 10) {
            if context.state.modeLabel == "FLOWTIME" {
              ActivityActionLink(
                title: context.state.isBreak ? "Resume Focus" : "Take Break",
                systemImage: context.state.isBreak ? "book.fill" : "cup.and.saucer.fill",
                destination: context.attributes.actionURL("toggle-break"),
                prominent: true
              )
            } else {
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
          .padding(.top, 6)
        }
      } compactLeading: {
        ActivityModeLabel(state: context.state, abbreviated: true)
      } compactTrailing: {
        ActivityTimerText(state: context.state, fontSize: 13, bold: false)
      } minimal: {
        Image(systemName: context.state.modeLabel == "FLOWTIME" ? "infinity" : "timer")
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
