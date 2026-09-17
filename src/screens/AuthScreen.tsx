import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as AppleAuthentication from "expo-apple-authentication";
// Imported statically like every other dependency: a dynamic import() builds a
// module namespace at runtime, which reads every export of the module at once.
// For "react-native" that crashed the app outright (see useFriends.ts).
import * as WebBrowser from "expo-web-browser";
import * as Crypto from "expo-crypto";
import Svg, { Path } from "react-native-svg";
import { supabase } from "../lib/supabase";
import { useAppStore } from "../store";
import { saveUserDisplayName } from "../hooks/useAuth";
import { hapticSuccess, hapticLight } from "../lib/haptics";
import { TextAction } from "../components/ui/TextAction";
import type { RootStackParamList } from "../navigation/types";
import { NEU, NEU_FONTS } from "../theme/neumorphism";

type Nav = NativeStackNavigationProp<RootStackParamList>;

async function signInWithApple() {
  const rawNonce = Array.from(
    await Crypto.getRandomBytesAsync(16),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");

  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!credential.identityToken) {
    throw new Error("Apple Sign-In failed: no identity token returned.");
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
    nonce: rawNonce,
  });

  if (error) throw error;

  // Apple only returns the person's name on the first authorization and does
  // not include it in the identity token. Capture it now or it is permanently
  // unavailable on later sign-ins.
  const givenName = credential.fullName?.givenName?.trim() || null;
  const middleName = credential.fullName?.middleName?.trim() || null;
  const familyName = credential.fullName?.familyName?.trim() || null;
  const displayName = [givenName, middleName, familyName]
    .filter(Boolean)
    .join(" ");

  if (displayName && data.user) {
    // Authentication itself succeeded. A transient auxiliary name write must
    // not turn that into a misleading sign-in failure. The profile row is
    // written before the auth metadata: updateUser emits USER_UPDATED, and the
    // profile reload that event starts must already read the saved name.
    let savedName: string | null = null;
    try {
      savedName = await saveUserDisplayName(data.user, displayName);
    } catch (profileError) {
      console.warn(
        "Apple Sign-In succeeded, but the first-time name could not be saved to the profile:",
        profileError,
      );
    }

    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        display_name: displayName,
        full_name: displayName,
        given_name: givenName,
        family_name: familyName,
      },
    });
    if (metadataError) {
      console.warn(
        "Apple Sign-In succeeded, but the first-time name could not be saved to the account metadata:",
        metadataError,
      );
    }

    const current = useAppStore.getState();
    if (savedName && current.userConfig?.id === data.user.id) {
      current.setUserConfig({
        ...current.userConfig,
        display_name: savedName,
      });
    }
  }
}

async function signInWithGoogle(): Promise<boolean> {
  const redirectUrl = "com.goals.app://google-auth";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data.url) throw new Error("No OAuth URL returned.");

  // Open the browser for Google sign-in
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

  if (result.type === "success" && result.url) {
    const url = new URL(result.url);
    const queryParams = url.searchParams;
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
    const readParam = (key: string) =>
      hashParams.get(key) ?? queryParams.get(key);
    const errorDescription =
      readParam("error_description") ?? readParam("error");
    if (errorDescription) {
      throw new Error(errorDescription.replace(/\+/g, " "));
    }

    const code = readParam("code");
    if (code) {
      const { error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) throw exchangeError;
      return true;
    }

    const accessToken = readParam("access_token");
    const refreshToken = readParam("refresh_token");

    if (accessToken && refreshToken) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (sessionError) throw sessionError;
      return true;
    }
    throw new Error("Google Sign-In returned without a session.");
  }

  return false;
}

function SocialAuthButton({
  provider,
  onPress,
  disabled,
}: {
  provider: "apple" | "google";
  onPress: () => void;
  disabled?: boolean;
}) {
  const label = `Continue with ${provider === "apple" ? "Apple" : "Google"}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        width: 66,
        height: 66,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.5 : 1,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <View
        pointerEvents="none"
        style={{
          width: 66,
          height: 66,
          borderRadius: 33,
          borderWidth: 1,
          borderColor: NEU.track,
          backgroundColor: NEU.card,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {provider === "apple" ? (
          <View style={{ transform: [{ translateX: -1 }, { translateY: -1 }] }}>
            <AppleLogo />
          </View>
        ) : (
          <GoogleLogo />
        )}
      </View>
    </Pressable>
  );
}

function AppleLogo() {
  return (
    <Svg width={31} height={31} viewBox="0 0 24 24" fill="none">
      <Path
        fill={NEU.textPrimary}
        d="M18.71 12.35c-.02-2.36 1.93-3.5 2.02-3.56-1.1-1.61-2.82-1.83-3.43-1.85-1.44-.15-2.84.86-3.57.86-.75 0-1.88-.85-3.1-.82-1.57.02-3.04.93-3.85 2.34-1.66 2.88-.42 7.12 1.17 9.45.8 1.13 1.72 2.38 2.93 2.33 1.18-.05 1.62-.75 3.04-.75 1.4 0 1.82.75 3.05.72 1.27-.02 2.07-1.13 2.84-2.27.92-1.3 1.29-2.58 1.3-2.65-.03-.01-2.38-.92-2.4-3.8ZM16.36 5.41c.64-.81 1.08-1.92.96-3.03-.93.04-2.1.65-2.77 1.44-.59.69-1.11 1.84-.98 2.91 1.05.08 2.12-.53 2.79-1.32Z"
      />
    </Svg>
  );
}

function GoogleLogo() {
  return (
    <Svg width={31} height={31} viewBox="0 0 48 48" fill="none">
      <Path
        fill="#FFC107"
        d="M43.61 20.08H42V20H24v8h11.3A12 12 0 1 1 31.68 14.4l5.66-5.65A20 20 0 1 0 44 24c0-1.35-.14-2.67-.39-3.92Z"
      />
      <Path fill="#FF3D00" d="m6.31 14.69 6.57 4.82A12 12 0 0 1 31.68 14.4l5.66-5.65A20 20 0 0 0 6.31 14.69Z" />
      <Path fill="#4CAF50" d="M24 44c5.2 0 9.93-1.99 13.49-5.23l-6.16-5.21A12 12 0 0 1 12.92 28.6l-6.52 5.02A20 20 0 0 0 24 44Z" />
      <Path fill="#1976D2" d="M43.61 20.08H42V20H24v8h11.3a12.05 12.05 0 0 1-3.97 5.56l6.16 5.21C37.05 39.17 44 34 44 24c0-1.35-.14-2.67-.39-3.92Z" />
    </Svg>
  );
}

export function AuthScreen() {
  const navigation = useNavigation<Nav>();
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ general?: string }>({});

  const clearFeedback = () => setFieldErrors({});

  const handleAppleSignIn = useCallback(async () => {
    setLoading(true);
    clearFeedback();
    try {
      await signInWithApple();
      hapticSuccess();
    } catch (err: unknown) {
      if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "ERR_REQUEST_CANCELED") {
        // User cancelled — do nothing
      } else {
        const message = err instanceof Error ? err.message : "Apple Sign-In failed.";
        setFieldErrors({ general: message });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleGoogleSignIn = useCallback(async () => {
    setLoading(true);
    clearFeedback();
    try {
      const signedIn = await signInWithGoogle();
      if (signedIn) hapticSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Google Sign-In failed.";
      setFieldErrors({ general: message });
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NEU.pageSolid }}>
      <ScrollView
        bounces={false}
        alwaysBounceVertical={false}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: 16,
          paddingBottom: 32,
          paddingHorizontal: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <TextAction
          label="Back"
          onPress={() => {
            if (loading) return;
            hapticLight();
            if (navigation.canGoBack()) navigation.goBack();
            else navigation.navigate("Onboarding");
          }}
          disabled={loading}
          containerStyle={{ marginBottom: 22, alignSelf: "flex-start" }}
          textStyle={{ color: NEU.textPrimary }}
        />

        <View style={{ flexGrow: 1, justifyContent: "center", paddingBottom: 40 }}>
          <Text
            style={{
              fontFamily: NEU_FONTS.heading,
              fontSize: 30,
              color: NEU.textPrimary,
              letterSpacing: -0.3,
              marginBottom: 8,
            }}
          >
            Sign in to Goals
          </Text>
          <Text
            style={{
              fontFamily: NEU_FONTS.body,
              fontSize: 16,
              color: NEU.textSecondary,
              lineHeight: 23,
              marginBottom: 40,
            }}
          >
            Your goals, your sessions and your island, safe across devices. No
            password to remember and no email to confirm.
          </Text>

          {fieldErrors.general ? (
            <View
              style={{
                backgroundColor: NEU.card,
                borderRadius: NEU.radiusSmall,
                paddingVertical: 12,
                paddingHorizontal: 16,
                marginBottom: 24,
              }}
            >
              <Text
                style={{
                  fontFamily: NEU_FONTS.body,
                  fontSize: 14,
                  color: NEU.textPrimary,
                  textAlign: "center",
                }}
              >
                {fieldErrors.general}
              </Text>
            </View>
          ) : null}

          {/*
            The two circles are now the way in rather than an alternative to it,
            but they keep the shape the design settled on (CLAUDE.md §10.1):
            66pt, side by side, flat outline. What changed is the room around
            them — they sit in the middle of the screen with their names under
            them, because an unlabelled circle is not an invitation.
          */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "flex-start",
              gap: 34,
            }}
          >
            {Platform.OS === "ios" ? (
              <View style={{ alignItems: "center" }}>
                <SocialAuthButton
                  provider="apple"
                  onPress={() => void handleAppleSignIn()}
                  disabled={loading}
                />
                <Text style={socialLabel}>Apple</Text>
              </View>
            ) : null}
            <View style={{ alignItems: "center" }}>
              <SocialAuthButton
                provider="google"
                onPress={() => void handleGoogleSignIn()}
                disabled={loading}
              />
              <Text style={socialLabel}>Google</Text>
            </View>
          </View>

          <Text
            style={{
              fontFamily: NEU_FONTS.body,
              fontSize: 13,
              color: NEU.textSecondary,
              textAlign: "center",
              lineHeight: 19,
              marginTop: 34,
            }}
          >
            {loading
              ? "Please wait…"
              : "Signing in for the first time creates your account."}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const socialLabel = {
  fontFamily: NEU_FONTS.label,
  fontSize: 14,
  color: NEU.textPrimary,
  marginTop: 10,
} as const;
