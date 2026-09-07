import ActivityKit
import ExpoModulesCore

struct GoalsFocusTimerAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
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

private struct FocusActivityPayload: Record {
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

  var contentState: GoalsFocusTimerAttributes.ContentState {
    GoalsFocusTimerAttributes.ContentState(
      goalName: goalName,
      modeLabel: modeLabel,
      phaseLabel: phaseLabel,
      isBreak: isBreak,
      isRunning: isRunning,
      timerCountsUp: timerCountsUp,
      timerDate: Date(timeIntervalSince1970: timerDateMs / 1_000),
      staticTime: staticTime
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
