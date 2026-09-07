import React from "react";
import {
  Button,
  HStack,
  Image,
  Spacer,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import {
  buttonStyle,
  controlSize,
  fixedSize,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  monospacedDigit,
  padding,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import {
  createLiveActivity,
} from "expo-widgets";

export interface FocusTimerActivityProps {
  sessionId: string;
  goalName: string;
  modeLabel: "FLOWTIME" | "INTERVALS";
  phaseLabel: "FOCUS MODE" | "RECOVERY MODE" | "BREAK MODE";
  isBreak: boolean;
  isRunning: boolean;
  timerCountsUp: boolean;
  timerDateMs: number;
  staticTime: string;
}

function FocusTimerActivity(props: FocusTimerActivityProps) {
  "widget";

  const primary = "#FFFFFF";
  const secondary = "#C8CBD4";
  const accent = "#7890FF";
  const timerDate = new Date(props.timerDateMs);
  const modeIcon = props.modeLabel === "FLOWTIME" ? "infinity" : "timer";
  const pauseLabel = props.isRunning ? "Pause" : "Resume";
  const pauseIcon = props.isRunning ? "pause.fill" : "play.fill";
  const phaseActionLabel = props.isBreak ? "Resume Focus" : "Take Break";
  const phaseActionIcon = props.isBreak ? "book.fill" : "cup.and.saucer.fill";
  const timer = props.isRunning ? (
    <Text
      date={timerDate}
      dateStyle="timer"
      modifiers={[
        font({ size: 32, weight: "bold", design: "rounded" }),
        monospacedDigit(),
        foregroundStyle(primary),
      ]}
    />
  ) : (
    <Text
      modifiers={[
        font({ size: 32, weight: "bold", design: "rounded" }),
        monospacedDigit(),
        foregroundStyle(primary),
      ]}
    >
      {props.staticTime}
    </Text>
  );
  const compactTimer = props.isRunning ? (
    <Text
      date={timerDate}
      dateStyle="timer"
      modifiers={[
        font({ size: 13, weight: "semibold", design: "rounded" }),
        monospacedDigit(),
        foregroundStyle(primary),
      ]}
    />
  ) : (
    <Text
      modifiers={[
        font({ size: 13, weight: "semibold", design: "rounded" }),
        monospacedDigit(),
        foregroundStyle(primary),
      ]}
    >
      {props.staticTime}
    </Text>
  );

  return {
    banner: (
      <VStack
        alignment="leading"
        spacing={10}
        modifiers={[padding({ all: 16 })]}
      >
        <HStack spacing={8}>
          <Image systemName={modeIcon} size={15} color={accent} />
          <Text
            modifiers={[
              font({ size: 13, weight: "bold" }),
              foregroundStyle(accent),
            ]}
          >
            {props.modeLabel}
          </Text>
          <Spacer />
          <Text
            modifiers={[
              font({ size: 13, weight: "semibold" }),
              foregroundStyle(secondary),
            ]}
          >
            {props.phaseLabel}
          </Text>
        </HStack>
        <HStack spacing={12}>
          <VStack alignment="leading" spacing={3}>
            <Text
              modifiers={[
                font({ size: 18, weight: "bold" }),
                foregroundStyle(primary),
                lineLimit(1),
              ]}
            >
              {props.goalName}
            </Text>
            <Text
              modifiers={[
                font({ size: 13, weight: "medium" }),
                foregroundStyle(secondary),
              ]}
            >
              {props.isRunning ? "Timer is running" : "Timer is paused"}
            </Text>
          </VStack>
          <Spacer />
          {timer}
        </HStack>
        <HStack spacing={10}>
          <Button
            label={pauseLabel}
            systemImage={pauseIcon}
            target="focus-timer-toggle-pause"
            modifiers={[
              buttonStyle("borderedProminent"),
              controlSize("regular"),
              tint("#415DCB"),
              frame({ minWidth: 112 }),
            ]}
          />
          <Button
            label={phaseActionLabel}
            systemImage={phaseActionIcon}
            target="focus-timer-toggle-break"
            modifiers={[
              buttonStyle("bordered"),
              controlSize("regular"),
              tint(accent),
              frame({ minWidth: 132 }),
            ]}
          />
        </HStack>
      </VStack>
    ),
    compactLeading: (
      <HStack spacing={4}>
        <Image systemName={modeIcon} size={12} color={accent} />
        <Text
          modifiers={[
            font({ size: 11, weight: "bold" }),
            foregroundStyle(accent),
          ]}
        >
          {props.modeLabel === "FLOWTIME" ? "FLOW" : "INT"}
        </Text>
      </HStack>
    ),
    compactTrailing: compactTimer,
    minimal: <Image systemName={modeIcon} size={13} color={accent} />,
    expandedLeading: (
      <VStack
        alignment="leading"
        spacing={3}
        modifiers={[padding({ leading: 4, top: 3 })]}
      >
        <HStack spacing={5}>
          <Image systemName={modeIcon} size={13} color={accent} />
          <Text
            modifiers={[
              font({ size: 12, weight: "bold" }),
              foregroundStyle(accent),
            ]}
          >
            {props.modeLabel}
          </Text>
        </HStack>
        <Text
          modifiers={[
            font({ size: 12, weight: "medium" }),
            foregroundStyle(secondary),
          ]}
        >
          {props.phaseLabel}
        </Text>
      </VStack>
    ),
    expandedTrailing: (
      <VStack
        alignment="trailing"
        spacing={2}
        modifiers={[
          padding({ trailing: 4, top: 2 }),
          fixedSize({ horizontal: true }),
        ]}
      >
        {compactTimer}
        <Text
          modifiers={[
            font({ size: 10, weight: "medium" }),
            foregroundStyle(secondary),
          ]}
        >
          {props.isRunning ? "RUNNING" : "PAUSED"}
        </Text>
      </VStack>
    ),
    expandedCenter: (
      <Text
        modifiers={[
          font({ size: 17, weight: "bold" }),
          foregroundStyle(primary),
          lineLimit(1),
          frame({ maxWidth: 230 }),
        ]}
      >
        {props.goalName}
      </Text>
    ),
    expandedBottom: (
      <HStack spacing={10} modifiers={[padding({ top: 7, horizontal: 4 })]}>
        <Button
          label={pauseLabel}
          systemImage={pauseIcon}
          target="focus-timer-toggle-pause"
          modifiers={[
            buttonStyle("borderedProminent"),
            controlSize("regular"),
            tint("#415DCB"),
            frame({ minWidth: 112 }),
          ]}
        />
        <Button
          label={phaseActionLabel}
          systemImage={phaseActionIcon}
          target="focus-timer-toggle-break"
          modifiers={[
            buttonStyle("bordered"),
            controlSize("regular"),
            tint(accent),
            frame({ minWidth: 132 }),
          ]}
        />
      </HStack>
    ),
  };
}

export const focusTimerActivity = createLiveActivity<FocusTimerActivityProps>(
  "GoalsFocusTimer",
  FocusTimerActivity,
);
