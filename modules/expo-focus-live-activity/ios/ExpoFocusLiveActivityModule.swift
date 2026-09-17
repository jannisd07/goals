import ActivityKit
import ExpoModulesCore

// Keep this in step with native/FocusLiveActivityWidget.swift and with
// FocusLiveActivityState in ../index.ts — all three describe the same payload.
struct GoalsFocusTimerAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
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
    /// plant | building | water | beach
    let growCategory: String
  }

  let sessionId: String
  let goalId: String
}

private struct FocusActivityPayload: Record {
  @Field var kind: String = "focus"
  @Field var sessionId: String
  @Field var goalId: String
  @Field var goalName: String
  @Field var modeLabel: String
  @Field var phaseLabel: String
  @Field var isBreak: Bool
  @Field var isRunning: Bool
  @Field var timerCountsUp: Bool
  @Field var timerDateMs: Double
  @Field var staticTime: String
  @Field var growName: String = ""
  @Field var growDetail: String = ""
  @Field var growCategory: String = ""

  var contentState: GoalsFocusTimerAttributes.ContentState {
    GoalsFocusTimerAttributes.ContentState(
      kind: kind,
      goalName: goalName,
      modeLabel: modeLabel,
      phaseLabel: phaseLabel,
      isBreak: isBreak,
      isRunning: isRunning,
      timerCountsUp: timerCountsUp,
      timerDate: Date(timeIntervalSince1970: timerDateMs / 1_000),
      staticTime: staticTime,
      growName: growName,
      growDetail: growDetail,
      growCategory: growCategory
    )
  }
}

public final class ExpoFocusLiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoFocusLiveActivity")

    Function("isSupported") {
      if #available(iOS 16.1, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    AsyncFunction("start") { (payload: FocusActivityPayload) async throws -> String? in
      guard #available(iOS 16.2, *) else {
        return nil
      }
      guard ActivityAuthorizationInfo().areActivitiesEnabled else {
        return nil
      }

      for activity in Activity<GoalsFocusTimerAttributes>.activities {
        await activity.end(nil, dismissalPolicy: .immediate)
      }

      let activity = try Activity.request(
        attributes: GoalsFocusTimerAttributes(
          sessionId: payload.sessionId,
          goalId: payload.goalId
        ),
        content: ActivityContent(
          state: payload.contentState,
          staleDate: nil
        ),
        pushType: nil
      )
      return activity.id
    }

    AsyncFunction("update") { (payload: FocusActivityPayload) async -> Bool in
      guard #available(iOS 16.2, *) else {
        return false
      }

      let content = ActivityContent(
        state: payload.contentState,
        staleDate: nil
      )
      var didUpdate = false
      for activity in Activity<GoalsFocusTimerAttributes>.activities {
        guard activity.attributes.sessionId == payload.sessionId else {
          await activity.end(nil, dismissalPolicy: .immediate)
          continue
        }
        await activity.update(content)
        didUpdate = true
      }
      return didUpdate
    }

    AsyncFunction("endAll") {
      guard #available(iOS 16.2, *) else {
        return
      }
      for activity in Activity<GoalsFocusTimerAttributes>.activities {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
    }
  }
}
