import React, { useState, useCallback } from "react";
import { View, Text, Pressable, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useAuth } from "../hooks/useAuth";
import { hapticSuccess } from "../lib/haptics";
import { NoiseTexture } from "../components/NoiseTexture";

export function AuthScreen() {
  const { signInWithEmail, signUpWithEmail } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please enter email and password.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      if (isLogin) {
        await signInWithEmail(email.trim(), password);
      } else {
        if (!displayName.trim()) {
          setError("Please enter your name.");
          setLoading(false);
          return;
        }
        await signUpWithEmail(email.trim(), password, displayName.trim());
      }
      hapticSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [email, password, displayName, isLogin, signInWithEmail, signUpWithEmail]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <NoiseTexture />
      <KeyboardAvoidingView
        className="flex-1 justify-center px-screen-x"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Animated.View entering={FadeIn.duration(600)}>
          <Text className="text-text-primary text-4xl font-bold text-center mb-2" style={{ fontFamily: "Outfit_700Bold" }}>VibeTime</Text>
          <Text className="text-text-tertiary text-body text-center mb-10">
            Your time, your currency.
          </Text>

          {!isLogin && (
            <Animated.View entering={FadeInDown.duration(300)}>
              <TextInput
                placeholder="Your name"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={displayName}
                onChangeText={setDisplayName}
                className="bg-white/[0.06] text-text-primary text-body px-4 py-3.5 rounded-button border border-surface-border mb-3"
                autoCapitalize="words"
              />
            </Animated.View>
          )}

          <TextInput
            placeholder="Email"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={email}
            onChangeText={setEmail}
            className="bg-white/[0.06] text-text-primary text-body px-4 py-3.5 rounded-button border border-surface-border mb-3"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            placeholder="Password"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={password}
            onChangeText={setPassword}
            className="bg-white/[0.06] text-text-primary text-body px-4 py-3.5 rounded-button border border-surface-border mb-3"
            secureTextEntry
          />

          {error !== "" && (
            <Text className="text-red-400 text-caption text-center mb-3">{error}</Text>
          )}

          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            className="items-center py-3.5 rounded-button bg-white mt-2 mb-4"
          >
            <Text className="text-background text-body font-semibold">
              {loading ? "..." : isLogin ? "Sign In" : "Create Account"}
            </Text>
          </Pressable>

          <Pressable onPress={() => { setIsLogin(!isLogin); setError(""); }}>
            <Text className="text-text-tertiary text-caption text-center">
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </Text>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
