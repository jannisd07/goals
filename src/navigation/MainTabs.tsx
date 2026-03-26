import React from "react";
import { View, Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { HomeScreen } from "../screens/HomeScreen";
import { GardenScreen } from "../screens/GardenScreen";
import { AnalyticsScreen } from "../screens/AnalyticsScreen";
import type { MainTabParamList } from "./types";

const Tab = createBottomTabNavigator<MainTabParamList>();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Home: "🏠",
    Garden: "✨",
    Analytics: "📊",
  };

  return (
    <View className="items-center justify-center pt-1">
      <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{icons[label] ?? "•"}</Text>
      <Text
        className={`text-tiny mt-0.5 ${focused ? "text-text-primary" : "text-text-tertiary"}`}
      >
        {label}
      </Text>
    </View>
  );
}

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0A0A0F",
          borderTopColor: "rgba(255,255,255,0.06)",
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 20,
          paddingTop: 8,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Home" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Garden"
        component={GardenScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Garden" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Analytics" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}
