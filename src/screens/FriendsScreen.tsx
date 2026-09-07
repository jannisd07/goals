import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { NeumorphicSurface } from "../components/NeumorphicSurface";
import { MinimalTextInput } from "../components/ui/MinimalTextInput";
import { PrimaryButton } from "../components/ui/PrimaryButton";
import { TextAction } from "../components/ui/TextAction";
import { ProgressBar } from "../components/ProgressBar";
import {
  useAddFriend,
  useFriendsWeekly,
  useMyFriendCode,
  useRemoveFriend,
  useShareFriendCode,
} from "../hooks/useFriends";
import { hapticMedium } from "../lib/haptics";
import type { FriendWeekly } from "../types";
import type { RootStackParamList } from "../navigation/types";
import { NEU, NEU_FONTS } from "../theme/neumorphism";

type Nav = NativeStackNavigationProp<RootStackParamList>;

function FriendRow({
  friend,
  onRemove,
}: {
  friend: FriendWeekly;
  onRemove: (friend: FriendWeekly) => void;
}) {
  const focusProgress =
    friend.focus_target_hours > 0 ? friend.focus_hours / friend.focus_target_hours : 0;

  const summaryParts: string[] = [];
  summaryParts.push(
    friend.focus_target_hours > 0
      ? `${friend.focus_hours.toFixed(1)} / ${friend.focus_target_hours}h focus`
      : `${friend.focus_hours.toFixed(1)}h focus`,
  );
  if (friend.checkin_target > 0) {
    summaryParts.push(`${friend.checkins} / ${friend.checkin_target} visits`);
  }

  return (
    <NeumorphicSurface style={styles.friendCard} contentPadding={16}>
      <View style={styles.friendHeader}>
        <Text style={styles.friendName} numberOfLines={1}>
          {friend.display_name || "Friend"}
        </Text>
        <Pressable
          onPress={() => onRemove(friend)}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${friend.display_name}`}
          style={({ pressed }) => ({
            minHeight: NEU.hitTarget,
            justifyContent: "center",
            paddingLeft: 12,
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <Text style={styles.removeLabel}>Remove</Text>
        </Pressable>
      </View>

      <ProgressBar
        progress={Math.min(1, focusProgress)}
        color={NEU.accent}
        height={5}
        trackColor={NEU.track}
      />
      <Text style={styles.friendSummary}>{summaryParts.join(" · ")}</Text>
    </NeumorphicSurface>
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NEU.bg }} edges={["top"]}>
      <Animated.View entering={FadeIn.duration(400)} style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={{ width: 72 }} />
            <Text style={styles.headerTitle}>Friends</Text>
            <TextAction label="Close" align="right" onPress={() => navigation.goBack()} />
          </View>

          {/* My code */}
          <Animated.View entering={FadeInDown.delay(50).duration(400)}>
            <NeumorphicSurface
              style={styles.card}
              contentPadding={20}
              lightShadowOpacity={0}
            >
              <Text style={styles.sectionHeader}>Your code</Text>
              <Text style={styles.codeValue}>
                {codeLoading ? "······" : codeError ? "Unavailable" : myCode ?? "Unavailable"}
              </Text>
              <Text style={styles.codeHint}>
                Friends who enter this code see your name and how your week is going — nothing
                else.
              </Text>
              {codeError ? (
                <TextAction label="Try Again" onPress={() => void refetchCode()} />
              ) : (
                <TextAction
                  label="Share code"
                  onPress={() => void shareCode()}
                  disabled={!myCode}
                />
              )}
            </NeumorphicSurface>
          </Animated.View>

          {/* Add friend */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <NeumorphicSurface style={styles.card} contentPadding={20}>
              <Text style={styles.sectionHeader}>Add a friend</Text>
              <MinimalTextInput
                value={codeInput}
                onChangeText={(text) =>
                  setCodeInput(
                    text
                      .toUpperCase()
                      .replace(/[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g, ""),
                  )
                }
                placeholder="Friend code"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={() => void handleAdd()}
              />
              <PrimaryButton
                label={addFriendMutation.isPending ? "Adding..." : "Add Friend"}
                onPress={() => void handleAdd()}
                disabled={addFriendMutation.isPending}
                containerStyle={{ marginTop: 14 }}
              />
            </NeumorphicSurface>
          </Animated.View>

          {/* Friends list */}
          <Animated.View entering={FadeInDown.delay(150).duration(400)}>
            <Text style={styles.listLabel}>This Week</Text>
            {friendsLoading ? (
              <Text style={styles.emptyText}>Loading...</Text>
            ) : friendsError ? (
              <NeumorphicSurface style={styles.card} contentPadding={20}>
                <Text style={styles.emptyTitle}>Friends could not be loaded</Text>
                <Text style={styles.emptyText}>Check your connection and try again.</Text>
                <TextAction label="Try Again" onPress={() => void refetchFriends()} />
              </NeumorphicSurface>
            ) : (friends ?? []).length === 0 ? (
              <NeumorphicSurface style={styles.card} contentPadding={20}>
                <Text style={styles.emptyTitle}>No friends yet</Text>
                <Text style={styles.emptyText}>
                  Share your code or enter a friend's code to see each other's weekly progress.
                </Text>
              </NeumorphicSurface>
            ) : (
              (friends ?? []).map((friend) => (
                <FriendRow key={friend.friend_id} friend={friend} onRemove={handleRemove} />
              ))
            )}
          </Animated.View>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 24,
  },
  headerTitle: {
    color: NEU.textPrimary,
    fontSize: 18,
    fontFamily: NEU_FONTS.heading,
  },
  card: {
    marginHorizontal: 24,
    marginBottom: 16,
  },
  sectionHeader: {
    color: NEU.textPrimary,
    fontSize: 16,
    fontFamily: NEU_FONTS.label,
    marginBottom: 12,
  },
  codeValue: {
    color: NEU.textPrimary,
    fontSize: 34,
    lineHeight: 38,
    fontFamily: NEU_FONTS.heading,
    letterSpacing: 6,
  },
  codeHint: {
    color: NEU.textSecondary,
    fontSize: 13,
    fontFamily: NEU_FONTS.body,
    lineHeight: 18,
    marginTop: 8,
    marginBottom: 4,
  },
  listLabel: {
    color: NEU.textSecondary,
    fontSize: 13,
    fontFamily: NEU_FONTS.label,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginHorizontal: 22,
    marginTop: 4,
    marginBottom: 14,
  },
  friendCard: {
    marginHorizontal: 24,
    marginBottom: 16,
  },
  friendHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  friendName: {
    color: NEU.textPrimary,
    fontSize: 16,
    fontFamily: NEU_FONTS.label,
    flex: 1,
  },
  removeLabel: {
    color: NEU.textSecondary,
    fontSize: 13,
    fontFamily: NEU_FONTS.label,
  },
  friendSummary: {
    color: NEU.textSecondary,
    fontSize: 13,
    fontFamily: NEU_FONTS.body,
    marginTop: 10,
  },
  emptyTitle: {
    color: NEU.textPrimary,
    fontSize: 18,
    fontFamily: NEU_FONTS.label,
    marginBottom: 8,
  },
  emptyText: {
    color: NEU.textSecondary,
    fontSize: 16,
    fontFamily: NEU_FONTS.body,
    lineHeight: 23,
    marginHorizontal: 0,
  },
});
