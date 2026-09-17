/**
 * The route container behind the app's single main screen.
 *
 * There used to be a second route here, "Grove", with its own star map. It is
 * gone on Jannis' call (2026-09-14): the island lives on Home and nowhere else.
 * The container itself stays, because "MainTabs" is the route name the rest of
 * the navigation and every `navigate("MainTabs")` still uses — and it keeps the
 * door open for a second main screen without touching those call sites.
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { HomeScreen } from "../screens/HomeScreen";
import { NEU } from "../theme/neumorphism";

export function MainTabs() {
  return (
    <View style={styles.root}>
      <HomeScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: NEU.bg,
  },
});
