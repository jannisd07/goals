import React from "react";
import { View } from "react-native";
import { BlurView } from "expo-blur";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
}

export function GlassCard({ children, className = "" }: GlassCardProps) {
  return (
    <View className={`overflow-hidden rounded-card ${className}`}>
      <BlurView intensity={20} tint="dark" className="p-card-padding">
        <View className="absolute inset-0 bg-white/[0.06] border border-surface-border rounded-card" />
        {children}
      </BlurView>
    </View>
  );
}
