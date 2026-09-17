/**
 * A friend's island, full screen.
 *
 * Nothing else is on it on purpose: no stats, no buttons, no overlay — the same
 * picture the friend sees when they open their own app, and a way back. The
 * numbers live one screen back in the list; this is the reward for the numbers.
 *
 * **It arrives in one piece.** The island's size decides which background is
 * drawn, and the size only arrives with the data — so showing a background
 * before then means showing someone else's island for a moment and swapping it
 * out underneath the viewer. Instead nothing of the island is shown until both
 * the data and the picture are ready, and then the whole scene fades in at once.
 *
 * Only what stands on the island travels (`get_friend_island`, guarded by the
 * friend link). Nothing here can change it: no placement, no dragging, no touch
 * targets over the island at all.
 */

import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { IslandObjectsLayer } from "../components/island/IslandObjectsLayer";
import { useFriendIsland } from "../hooks/useFriends";
import { HOME_ISLAND_STAGES } from "../lib/homeIslandStages";
import { hapticLight } from "../lib/haptics";
import { seedForUser } from "../lib/islandPlacement";
import { islandRoman, type IslandStage } from "../lib/islandScene";
import type { RootStackParamList } from "../navigation/types";
import { NEU_FONTS } from "../theme/neumorphism";
import { PAPER } from "../theme/paper";

type IslandRoute = RouteProp<RootStackParamList, "FriendIsland">;
type IslandNav = NativeStackNavigationProp<RootStackParamList>;

export function FriendIslandScreen() {
  const route = useRoute<IslandRoute>();
  const navigation = useNavigation<IslandNav>();
  const { friendId, name } = route.params;
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const island = useFriendIsland(friendId);

  /** The background is a large picture; it is only shown once it is decoded. */
  const [painted, setPainted] = useState(false);
  const data = island.data ?? null;
  const ready = data !== null && painted;

  const fade = useSharedValue(0);
  useEffect(() => {
    if (ready) fade.value = withTiming(1, { duration: 340 });
  }, [fade, ready]);
  const sceneStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const stage = (data?.stage ?? 1) as IslandStage;
  const back = () => {
    hapticLight();
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("MainTabs");
  };

  return (
    <View style={styles.root}>
      {/* Mounted only once the size is known, so no wrong island is ever shown. */}
      {data ? (
        <Animated.View style={[StyleSheet.absoluteFill, sceneStyle]} pointerEvents="none">
          <ImageBackground
            source={HOME_ISLAND_STAGES[stage - 1].background}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            fadeDuration={0}
            onLoad={() => setPainted(true)}
          >
            <IslandObjectsLayer
              stage={stage}
              island={data.objects}
              spots={data.spots}
              seed={seedForUser(friendId)}
              screenWidth={screenWidth}
              screenHeight={screenHeight}
            />
          </ImageBackground>
        </Animated.View>
      ) : null}

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.top}>
          {/* Back works from the first frame: a loading screen you cannot leave
              is worse than a slow one. */}
          <Pressable
            onPress={back}
            accessibilityRole="button"
            accessibilityLabel="Back to friends"
            hitSlop={12}
            style={({ pressed }) => [styles.backTouch, { opacity: pressed ? 0.6 : 1 }]}
          >
            <View style={styles.chip}>
              <Text style={styles.chipText}>Back</Text>
            </View>
          </Pressable>

          <View style={styles.chip}>
            <Text style={styles.chipText} numberOfLines={1}>
              {ready ? `${name} · Island ${islandRoman(stage)}` : name}
            </Text>
          </View>
        </View>

        <View style={styles.middle} pointerEvents="none">
          {island.isError ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>This island could not be loaded.</Text>
            </View>
          ) : ready ? null : (
            <>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={styles.waiting} accessibilityRole="text">
                {`Sailing over to ${name}…`}
              </Text>
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  // The sea the island will sit in, so the wait is the same picture minus the
  // island rather than a different screen.
  root: { flex: 1, backgroundColor: PAPER.openSea },
  safe: { flex: 1 },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: 12,
    gap: 12,
  },
  backTouch: { minHeight: 44, justifyContent: "center" },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: PAPER.onIslandScrim,
    flexShrink: 1,
  },
  chipText: {
    fontFamily: NEU_FONTS.label,
    fontSize: 13,
    letterSpacing: 0.3,
    color: "#FFFFFF",
  },
  middle: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  waiting: {
    fontFamily: NEU_FONTS.body,
    fontSize: 14,
    color: "#FFFFFF",
    opacity: 0.9,
  },
});
