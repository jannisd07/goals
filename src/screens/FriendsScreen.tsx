import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  Pressable,
  ActivityIndicator,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MinimalTextInput } from "../components/ui/MinimalTextInput";
import { PrimaryButton } from "../components/ui/PrimaryButton";
import { IslandBadge } from "../components/island/IslandBadge";
import {
  PaperCard,
  PaperHeader,
  PaperLabel,
  PaperRow,
  PaperScreen,
} from "../components/paper/PaperUI";
import {
  useAddFriend,
  useFriendsWeekly,
  useMyFriendCode,
  useRemoveFriend,
  useShareFriendCode,
} from "../hooks/useFriends";
import { hapticLight, hapticMedium } from "../lib/haptics";
import { islandRoman } from "../lib/islandScene";
import type { FriendWeekly } from "../types";
import type { RootStackParamList } from "../navigation/types";
import { PAPER } from "../theme/paper";
import { NEU_FONTS } from "../theme/neumorphism";

type Nav = NativeStackNavigationProp<RootStackParamList>;

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function FriendRow({
  friend,
  first,
  onRemove,
  onVisit,
}: {
  friend: FriendWeekly;
  first: boolean;
  onRemove: (friend: FriendWeekly) => void;
  onVisit: (friend: FriendWeekly) => void;
}) {
  // Three numbers, always in the same places: how often they showed up, how long
  // they worked, and how much of both there has ever been. A row of values that
  // never moves is read at a glance; a sentence of mixed units is not.
  const stage = Math.max(1, Math.min(5, Math.round(friend.island_stage ?? 1)));
  const checkins =
    friend.checkin_target > 0
      ? `${friend.checkins} / ${friend.checkin_target}`
      : friend.checkins > 0
        ? `${friend.checkins}`
        : "—";
  const focus =
    friend.focus_target_hours > 0
      ? `${friend.focus_hours.toFixed(1)} / ${friend.focus_target_hours}h`
      : `${friend.focus_hours.toFixed(1)}h`;
  const total = `${Math.round(friend.total_hours ?? 0)}h`;

  return (
    <PaperRow first={first} style={styles.friendRow}>
      <View style={styles.friendLine}>
        {/* The island is the way in: tapping it goes and looks at it. */}
        <Pressable
          onPress={() => onVisit(friend)}
          accessibilityRole="button"
          accessibilityLabel={`Visit ${friend.display_name || "your friend"}'s island, size ${stage}`}
          style={({ pressed }) => [styles.friendBadge, { opacity: pressed ? 0.7 : 1 }]}
        >
          <IslandBadge stage={stage} />
          <Text style={styles.badgeCaption} numberOfLines={1}>
            {`Island ${islandRoman(stage)}`}
          </Text>
        </Pressable>

        <View style={styles.friendBody}>
          <View style={styles.friendTop}>
            <Text style={styles.friendName} numberOfLines={1}>
              {friend.display_name || "Friend"}
            </Text>
            <Pressable
              onPress={() => onRemove(friend)}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${friend.display_name}`}
              hitSlop={10}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
            >
              <Text style={styles.removeLabel}>Remove</Text>
            </Pressable>
          </View>

          <View style={styles.statRow}>
            <Stat value={checkins} label="Check-ins" />
            <Stat value={focus} label="Focus" />
            <Stat value={total} label="All time" />
          </View>
        </View>
      </View>
    </PaperRow>
  );
}

export function FriendsScreen() {
  const navigation = useNavigation<Nav>();
  const {
    data: myCode,
    isLoading: codeLoading,
    isError: codeError,
    refetch: refetchCode,
  } = useMyFriendCode();
  const {
    data: friends,
    isLoading: friendsLoading,
    isError: friendsError,
    refetch: refetchFriends,
  } = useFriendsWeekly();
  const addFriendMutation = useAddFriend();
  const removeFriendMutation = useRemoveFriend();
  const shareCode = useShareFriendCode(myCode);

  const [codeInput, setCodeInput] = useState("");

  const handleVisit = useCallback(
    (friend: FriendWeekly) => {
      hapticLight();
      navigation.navigate("FriendIsland", {
        friendId: friend.friend_id,
        name: friend.display_name || "Friend",
      });
    },
    [navigation],
  );

  const handleAdd = useCallback(async () => {
    const code = codeInput.trim();
    if (code.length !== 6) {
      Alert.alert("Enter a code", "Ask your friend for their 6-character code.");
      return;
    }
    try {
      const { display_name } = await addFriendMutation.mutateAsync(code);
      setCodeInput("");
      hapticMedium();
      Alert.alert("Connected", `You and ${display_name} are now friends.`);
    } catch (error) {
      Alert.alert("Could not add friend", error instanceof Error ? error.message : "Try again.");
    }
  }, [codeInput, addFriendMutation]);

  const handleRemove = useCallback(
    (friend: FriendWeekly) => {
      Alert.alert("Remove friend", `Remove ${friend.display_name} from your friends?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void removeFriendMutation.mutateAsync(friend.friend_id).catch((error) => {
              Alert.alert(
                "Could not remove friend",
                error instanceof Error ? error.message : "Please try again.",
              );
            });
          },
        },
      ]);
    },
    [removeFriendMutation],
  );

  const friendList = friends ?? [];

  return (
    <PaperScreen edges={["top"]}>
      <PaperHeader
        title="Friends"
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
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <PaperLabel style={styles.firstLabel}>Your code</PaperLabel>
          <PaperCard padding={18}>
            <View style={styles.codeRow}>
              <Text style={styles.codeValue}>
                {codeLoading ? "······" : codeError ? "Unavailable" : myCode ?? "Unavailable"}
              </Text>
              {codeError ? (
                <Pressable
                  onPress={() => void refetchCode()}
                  accessibilityRole="button"
                  accessibilityLabel="Try again"
                  hitSlop={10}
                  style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                >
                  <Text style={styles.inlineAction}>Try again</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => void shareCode()}
                  disabled={!myCode}
                  accessibilityRole="button"
                  accessibilityLabel="Share code"
                  accessibilityState={{ disabled: !myCode }}
                  hitSlop={10}
                  style={({ pressed }) => ({ opacity: !myCode ? 0.35 : pressed ? 0.5 : 1 })}
                >
                  <Text style={styles.inlineAction}>Share</Text>
                </Pressable>
              )}
            </View>
            <Text style={styles.codeHint}>
              Friends who enter this code see your name, how your week is going and your
              island — nothing else.
            </Text>
          </PaperCard>

          <PaperLabel>Add a friend</PaperLabel>
          <View style={styles.addBlock}>
            <MinimalTextInput
              value={codeInput}
              onChangeText={(text) =>
                setCodeInput(
                  text.toUpperCase().replace(/[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g, ""),
                )
              }
              placeholder="Friend code"
              placeholderTextColor={PAPER.inkFaint}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              returnKeyType="done"
              onSubmitEditing={() => void handleAdd()}
              containerStyle={styles.input}
              style={styles.inputText}
            />
            <PrimaryButton
              label={addFriendMutation.isPending ? "Adding..." : "Add Friend"}
              onPress={() => void handleAdd()}
              disabled={addFriendMutation.isPending}
              containerStyle={{ marginTop: 12 }}
            />
          </View>

          <PaperLabel>This week</PaperLabel>
          {friendsLoading ? (
            <PaperCard padding={22} style={styles.centered}>
              <ActivityIndicator size="small" color={PAPER.accent} />
            </PaperCard>
          ) : friendsError ? (
            <PaperCard padding={18}>
              <Text style={styles.stateTitle}>Friends could not be loaded</Text>
              <Text style={styles.stateText}>Check your connection and try again.</Text>
              <Pressable
                onPress={() => void refetchFriends()}
                accessibilityRole="button"
                accessibilityLabel="Try again"
                style={({ pressed }) => [styles.stateAction, { opacity: pressed ? 0.5 : 1 }]}
              >
                <Text style={styles.inlineAction}>Try again</Text>
              </Pressable>
            </PaperCard>
          ) : friendList.length === 0 ? (
            <PaperCard padding={18}>
              <Text style={styles.stateTitle}>No friends yet</Text>
              <Text style={styles.stateText}>
                Share your code or enter a friend's code to see each other's weekly progress.
              </Text>
            </PaperCard>
          ) : (
            <PaperCard padding={0}>
              {friendList.map((friend, index) => (
                <FriendRow
                  key={friend.friend_id}
                  friend={friend}
                  first={index === 0}
                  onRemove={handleRemove}
                  onVisit={handleVisit}
                />
              ))}
            </PaperCard>
          )}
        </ScrollView>
      </Animated.View>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    paddingBottom: 48,
  },
  firstLabel: {
    marginTop: 12,
  },

  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  codeValue: {
    color: PAPER.ink,
    fontSize: 30,
    lineHeight: 36,
    fontFamily: NEU_FONTS.heading,
    letterSpacing: 5,
  },
  codeHint: {
    color: PAPER.inkMuted,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: NEU_FONTS.body,
    marginTop: 10,
  },
  inlineAction: {
    color: PAPER.accentInk,
    fontSize: 15,
    fontFamily: NEU_FONTS.label,
  },

  addBlock: {
    paddingHorizontal: PAPER.gutter,
  },
  input: {
    backgroundColor: PAPER.surface,
    borderColor: PAPER.line,
  },
  inputText: {
    color: PAPER.ink,
    letterSpacing: 2,
  },

  friendRow: {
    paddingVertical: 14,
  },
  friendLine: {
    flexDirection: "row",
    alignItems: "center",
  },
  friendBadge: {
    width: 62,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeCaption: {
    marginTop: 5,
    color: PAPER.inkMuted,
    fontSize: 10,
    fontFamily: NEU_FONTS.label,
  },
  friendBody: {
    flex: 1,
    marginLeft: 12,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  stat: {
    flex: 1,
  },
  statValue: {
    color: PAPER.ink,
    fontSize: 15,
    fontFamily: NEU_FONTS.label,
    fontVariant: ["tabular-nums"],
  },
  statLabel: {
    marginTop: 2,
    color: PAPER.inkMuted,
    fontSize: 11,
    fontFamily: NEU_FONTS.body,
  },
  friendTop: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  friendName: {
    color: PAPER.ink,
    fontSize: 16,
    fontFamily: NEU_FONTS.label,
    flex: 1,
    marginRight: 12,
  },
  friendValue: {
    color: PAPER.ink,
    fontSize: 15,
    fontFamily: NEU_FONTS.label,
    fontVariant: ["tabular-nums"],
  },
  friendBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 9,
  },
  friendMeta: {
    color: PAPER.inkMuted,
    fontSize: 13,
    fontFamily: NEU_FONTS.body,
    fontVariant: ["tabular-nums"],
    flex: 1,
    marginRight: 12,
  },
  removeLabel: {
    color: PAPER.inkFaint,
    fontSize: 13,
    fontFamily: NEU_FONTS.label,
  },

  centered: {
    alignItems: "center",
  },
  stateTitle: {
    color: PAPER.ink,
    fontSize: 16,
    fontFamily: NEU_FONTS.label,
    marginBottom: 6,
  },
  stateText: {
    color: PAPER.inkMuted,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: NEU_FONTS.body,
  },
  stateAction: {
    minHeight: PAPER.hitTarget,
    justifyContent: "center",
    marginTop: 2,
  },
});
