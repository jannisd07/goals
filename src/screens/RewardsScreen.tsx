import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { PaperCard, PaperHeader, PaperLabel, PaperScreen } from "../components/paper/PaperUI";
import { PixelSprite, rewardSpriteName } from "../components/PixelArt";
import { ProgressBar } from "../components/ProgressBar";
import { useLifetimeHours } from "../hooks/useLifetimeHours";
import { hapticLight } from "../lib/haptics";
import {
  REWARD_MILESTONES,
  formatMilestoneHours,
  formatRewardHours,
  rewardProgress,
  type RewardMilestone,
} from "../lib/rewards";
import type { RootStackParamList } from "../navigation/types";
import { NEU_FONTS } from "../theme/neumorphism";
import { PAPER } from "../theme/paper";
import { FlagPicker } from "../components/island/FlagPicker";
import { useAppStore } from "../store";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Locked rewards show only their shape, so the roadmap still teases what comes. */
const SILHOUETTE = "#D2D1CA";
const BADGE = 56;

function MilestoneRow({
  milestone,
  total,
  isNext,
  progressToNext,
  nextUnlocked,
  first,
  last,
  flag,
  onPickFlag,
}: {
  milestone: RewardMilestone;
  total: number;
  isNext: boolean;
  progressToNext: number;
  nextUnlocked: boolean;
  first: boolean;
  last: boolean;
  /** The flag currently flying, for the one milestone that has a choice. */
  flag?: string | null;
  onPickFlag?: (code: string | null) => void;
}) {
  const unlocked = total >= milestone.hours;
  const remaining = Math.max(0, milestone.hours - total);
  const status = unlocked
    ? "Unlocked"
    : isNext
      ? `${formatRewardHours(remaining)} to go`
      : "Locked";

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${milestone.title}, ${formatMilestoneHours(milestone.hours)}, ${status}`}
    >
      <View style={styles.rail}>
        <View style={[styles.railSegment, unlocked && styles.railDone, first && styles.railHidden]} />
        <View style={[styles.badge, unlocked && styles.badgeDone, isNext && styles.badgeNext]}>
          <PixelSprite
            name={rewardSpriteName(milestone.object, milestone.tier)}
            size={40}
            silhouette={unlocked || isNext ? undefined : SILHOUETTE}
            opacity={isNext ? 0.55 : 1}
          />
        </View>
        <View style={[styles.railSegment, nextUnlocked && styles.railDone, last && styles.railHidden]} />
      </View>

      <View style={styles.body}>
        <Text style={styles.kicker}>
          {formatMilestoneHours(milestone.hours)} · {milestone.tier === 2 ? "Upgrade" : "New object"}
        </Text>
        <Text style={[styles.title, !unlocked && !isNext && styles.titleLocked]}>{milestone.title}</Text>
        <Text style={styles.description}>{milestone.description}</Text>
        {isNext ? (
          <View style={styles.rowProgress}>
            <ProgressBar
              progress={progressToNext}
              color={PAPER.accent}
              height={5}
              trackColor={PAPER.sunken}
            />
          </View>
        ) : null}
        <Text style={[styles.status, unlocked && styles.statusDone, isNext && styles.statusNext]}>
          {status}
        </Text>
        {/*
          The flagpole is the one landmark with a choice in it. It belongs here,
          on the card that hands it over, rather than hidden in Settings.
        */}
        {unlocked && milestone.object === "flagpole" && onPickFlag ? (
          <View style={styles.flagBlock}>
            <FlagPicker selected={flag ?? null} onSelect={onPickFlag} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function RewardsScreen() {
  const navigation = useNavigation<Nav>();
  const lifetime = useLifetimeHours();
  const total = lifetime.data ?? 0;
  const progress = rewardProgress(total);
  const nextId = progress.next?.id ?? null;
  const userId = useAppStore((state) => state.userConfig?.id ?? null);
  const flagpoleFlag = useAppStore((state) =>
    userId ? (state.islandObjectsByUser[userId]?.flagpole?.variant ?? null) : null,
  );
  const setIslandObjectVariant = useAppStore((state) => state.setIslandObjectVariant);

  return (
    <PaperScreen edges={["top"]}>
      <PaperHeader
        title="Rewards"
        onClose={() => {
          hapticLight();
          navigation.goBack();
        }}
      />
      <Animated.View entering={FadeIn.duration(220)} style={styles.flex}>
        <ScrollView
          bounces={false}
          alwaysBounceVertical={false}
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {lifetime.isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={PAPER.accent} />
            </View>
          ) : lifetime.isError ? (
            <PaperCard padding={18} style={styles.firstCard}>
              <Text style={styles.stateTitle}>Rewards could not be loaded</Text>
              <Text style={styles.stateText}>Check your connection and try again.</Text>
              <Pressable
                onPress={() => void lifetime.refetch()}
                accessibilityRole="button"
                accessibilityLabel="Try again"
                style={({ pressed }) => [styles.retry, { opacity: pressed ? 0.5 : 1 }]}
              >
                <Text style={styles.link}>Try again</Text>
              </Pressable>
            </PaperCard>
          ) : (
            <>
              <PaperCard padding={18} style={styles.firstCard}>
                <Text style={styles.heroLabel}>Total time</Text>
                <Text style={styles.heroValue}>{formatRewardHours(total)}</Text>
                <Text style={styles.heroSub}>Focus Timer and Auto Check-In together</Text>
                {progress.next ? (
                  <View style={styles.nextBlock}>
                    <View style={styles.nextRow}>
                      <Text style={styles.nextText} numberOfLines={1}>
                        Next: {progress.next.title}
                      </Text>
                      <Text style={styles.nextHours}>
                        {formatRewardHours(progress.hoursToNext)} to go
                      </Text>
                    </View>
                    <ProgressBar
                      progress={progress.progressToNext}
                      color={PAPER.accent}
                      height={6}
                      trackColor={PAPER.sunken}
                    />
                  </View>
                ) : (
                  <Text style={styles.allDone}>Every reward unlocked.</Text>
                )}
              </PaperCard>

              <PaperLabel>Roadmap</PaperLabel>
              <PaperCard padding={0}>
                {REWARD_MILESTONES.map((milestone, index) => {
                  const following = REWARD_MILESTONES[index + 1];
                  return (
                    <MilestoneRow
                      key={milestone.id}
                      milestone={milestone}
                      total={total}
                      isNext={milestone.id === nextId}
                      progressToNext={progress.progressToNext}
                      nextUnlocked={following ? total >= following.hours : false}
                      first={index === 0}
                      last={index === REWARD_MILESTONES.length - 1}
                      flag={flagpoleFlag}
                      onPickFlag={
                        userId
                          ? (code) => setIslandObjectVariant(userId, "flagpole", code)
                          : undefined
                      }
                    />
                  );
                })}
              </PaperCard>
            </>
          )}
        </ScrollView>
      </Animated.View>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  flagBlock: { marginTop: 14 },
  flex: { flex: 1 },
  scroll: { paddingBottom: 48 },
  loading: { minHeight: 220, alignItems: "center", justifyContent: "center" },
  firstCard: { marginTop: 12 },

  heroLabel: {
    color: PAPER.inkFaint,
    fontSize: 11,
    fontFamily: NEU_FONTS.label,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  heroValue: {
    color: PAPER.ink,
    fontSize: 40,
    lineHeight: 46,
    fontFamily: NEU_FONTS.heading,
    fontVariant: ["tabular-nums"],
    marginTop: 4,
  },
  heroSub: { color: PAPER.inkMuted, fontSize: 13, fontFamily: NEU_FONTS.body, marginTop: 2 },
  nextBlock: { marginTop: 16 },
  nextRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 8,
  },
  nextText: { flex: 1, color: PAPER.ink, fontSize: 15, fontFamily: NEU_FONTS.label, marginRight: 12 },
  nextHours: {
    color: PAPER.accentInk,
    fontSize: 14,
    fontFamily: NEU_FONTS.label,
    fontVariant: ["tabular-nums"],
  },
  allDone: { color: PAPER.accentInk, fontSize: 15, fontFamily: NEU_FONTS.label, marginTop: 14 },

  row: { flexDirection: "row", paddingRight: 16 },
  rail: { width: BADGE + 28, alignItems: "center" },
  railSegment: { width: 3, flex: 1, minHeight: 14, backgroundColor: PAPER.line },
  railDone: { backgroundColor: PAPER.accent },
  railHidden: { backgroundColor: "transparent" },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PAPER.line,
    backgroundColor: PAPER.sunken,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeDone: { backgroundColor: PAPER.accentWash, borderColor: PAPER.accent },
  badgeNext: { backgroundColor: PAPER.surface, borderColor: PAPER.accent, borderWidth: 2 },
  body: { flex: 1, paddingVertical: 16 },
  kicker: {
    color: PAPER.inkFaint,
    fontSize: 11,
    fontFamily: NEU_FONTS.label,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: { color: PAPER.ink, fontSize: 17, fontFamily: NEU_FONTS.label, marginTop: 3 },
  titleLocked: { color: PAPER.inkMuted },
  description: {
    color: PAPER.inkMuted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: NEU_FONTS.body,
    marginTop: 2,
  },
  rowProgress: { marginTop: 10 },
  status: { color: PAPER.inkFaint, fontSize: 13, fontFamily: NEU_FONTS.label, marginTop: 8 },
  statusDone: { color: PAPER.accentInk },
  statusNext: { color: PAPER.ink },

  stateTitle: { color: PAPER.ink, fontSize: 16, fontFamily: NEU_FONTS.label, marginBottom: 6 },
  stateText: { color: PAPER.inkMuted, fontSize: 15, lineHeight: 21, fontFamily: NEU_FONTS.body },
  retry: { minHeight: PAPER.hitTarget, justifyContent: "center", marginTop: 2 },
  link: { color: PAPER.accentInk, fontSize: 15, fontFamily: NEU_FONTS.label },
});
