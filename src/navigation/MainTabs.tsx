import React from "react";
import { StyleSheet, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { HomeScreen } from "../screens/HomeScreen";
import { GardenScreen } from "../screens/GardenScreen";
import { NEU } from "../theme/neumorphism";
import type { MainTabParamList } from "./types";

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  return (
    <View style={styles.root}>
      <Tab.Navigator
        tabBar={() => null}
        screenOptions={{
          headerShown: false,
          sceneStyle: {
            backgroundColor: NEU.bg,
          },
        }}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Grove" component={GardenScreen} />
      </Tab.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: NEU.bg,
  },
});
