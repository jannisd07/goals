import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import Svg, { Path } from "react-native-svg";
import { supabase } from "../lib/supabase";
import { useAppStore } from "../store";
import { useAuth } from "../hooks/useAuth";
import { hapticSuccess, hapticLight } from "../lib/haptics";
import { TextAction } from "../components/ui/TextAction";
import { MinimalTextInput } from "../components/ui/MinimalTextInput";
import type { RootStackParamList } from "../navigation/types";
import { NEU, NEU_FONTS } from "../theme/neumorphism";

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ---------- Inline Text Input ----------
function AuthInput({
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  autoCapitalize,
  keyboardType,
  autoCorrect,
  error,
  onToggleSecure,
  showToggle,
}: {
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "words" | "sentences";
  keyboardType?: "email-address" | "default";
  autoCorrect?: boolean;
  error?: string;
  onToggleSecure?: () => void;
  showToggle?: boolean;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <MinimalTextInput
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize ?? "none"}
        keyboardType={keyboardType ?? "default"}
        autoCorrect={autoCorrect ?? false}
        error={Boolean(error)}
        rightAccessory={
          showToggle ? (
          <Pressable
            onPress={onToggleSecure}
            accessibilityRole="button"
            accessibilityLabel={secureTextEntry ? "Show password" : "Hide password"}
            style={{
              minWidth: NEU.hitTarget,
              minHeight: NEU.hitTarget,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontFamily: NEU_FONTS.body,
                fontSize: 13,
                color: NEU.textSecondary,
              }}
            >
              {secureTextEntry ? "Show" : "Hide"}
            </Text>
          </Pressable>
          ) : null
        }
      />
      {error ? (
        <Text
          style={{
            fontFamily: NEU_FONTS.body,
            fontSize: 13,
            color: NEU.textPrimary,
            marginTop: 6,
            marginLeft: 4,
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

// ---------- Tab Selector ----------
function AuthTabs({
  activeTab,
  onSelect,
  disabled,
}: {
  activeTab: "signin" | "signup";
  onSelect: (t: "signin" | "signup") => void;
  disabled?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        marginBottom: 30,
        gap: 32,
        justifyContent: "center",
      }}
    >
      {(["signup", "signin"] as const).map((tab) => {
        const isActive = activeTab === tab;
        return (
          <Pressable
            key={tab}
            onPress={() => {
              if (disabled) return;
              hapticLight();
              onSelect(tab);
            }}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive, disabled: Boolean(disabled) }}
            style={{
              paddingBottom: 8,
              minHeight: NEU.hitTarget,
              justifyContent: "flex-end",
              borderBottomWidth: isActive ? 2 : 0,
              borderBottomColor: NEU.accent,
              opacity: disabled ? 0.6 : 1,
            }}
          >
            <Text
              style={{
                fontFamily: isActive ? NEU_FONTS.label : NEU_FONTS.body,
                fontSize: 16,
                color: isActive ? NEU.accent : NEU.textSecondary,
              }}
            >
              {tab === "signin" ? "Sign In" : "Sign Up"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- OAuth Helpers ----------
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
    const [metadataResult, profileResult] = await Promise.all([
      supabase.auth.updateUser({
        data: {
          display_name: displayName,
          full_name: displayName,
          given_name: givenName,
          family_name: familyName,
        },
      }),
      supabase
        .from("users")
        .upsert(
          {
            id: data.user.id,
            display_name: displayName,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        ),
    ]);

    // Authentication itself succeeded. A transient auxiliary name write must
    // not turn that into a misleading sign-in failure.
    if (metadataResult.error || profileResult.error) {
      console.warn(
        "Apple Sign-In succeeded, but the first-time name could not be saved:",
        metadataResult.error ?? profileResult.error,
      );
    } else {
      const current = useAppStore.getState();
      if (current.userConfig?.id === data.user.id) {
        current.setUserConfig({
          ...current.userConfig,
          display_name: displayName,
        });
      }
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
  const WebBrowser = await import("expo-web-browser");
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

function AuthSubmitButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => ({
        minHeight: 56,
        opacity: disabled ? 0.42 : pressed ? 0.82 : 1,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      <View
        pointerEvents="none"
        style={{
          minHeight: 56,
          flex: 1,
          borderRadius: NEU.radius,
          backgroundColor: NEU.textPrimary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 17,
            fontFamily: NEU_FONTS.label,
            letterSpacing: 0.1,
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

// ---------- Main Auth Screen ----------
export function AuthScreen() {
  const navigation = useNavigation<Nav>();
  const {
    signInWithEmail,
    signUpWithEmail,
    resendSignupConfirmation,
    requestPasswordReset,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signup");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<{
    firstName?: string;
    email?: string;
    password?: string;
    general?: string;
  }>({});

  const clearErrors = () => setFieldErrors({});

  const clearFeedback = () => {
    clearErrors();
    setNotice(null);
  };

  const validate = (): boolean => {
    const errors: typeof fieldErrors = {};
    if (activeTab === "signup" && !firstName.trim()) {
      errors.firstName = "First name is required.";
    }
    if (!email.trim()) {
      errors.email = "Email is required.";
    } else if (!/\S+@\S+\.\S+/.test(email.trim())) {
      errors.email = "Please enter a valid email.";
    }
    if (!password) {
      errors.password = "Password is required.";
    } else if (activeTab === "signup" && password.length < 8) {
      errors.password = "Password must be at least 8 characters.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    setLoading(true);
    clearFeedback();

    const normalizedEmail = email.trim().toLowerCase();

    try {
      if (activeTab === "signin") {
        await signInWithEmail(normalizedEmail, password);
      } else {
        const result = await signUpWithEmail(normalizedEmail, password, firstName.trim());
        if (result.requiresEmailConfirmation) {
          setNotice("Check your inbox to confirm your email before signing in.");
          setActiveTab("signin");
        }
      }
      hapticSuccess();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : activeTab === "signup"
            ? "Could not create account. Please check your details and try again."
            : "Could not sign in. Please check your email and password.";
      setFieldErrors({ general: message });
    } finally {
      setLoading(false);
    }
  }, [email, password, firstName, activeTab, signInWithEmail, signUpWithEmail]);

  const handleForgotPassword = useCallback(async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setFieldErrors((prev) => ({ ...prev, email: "Enter your email first." }));
      return;
    }
    if (!/\S+@\S+\.\S+/.test(normalizedEmail)) {
      setFieldErrors((prev) => ({ ...prev, email: "Please enter a valid email." }));
      return;
    }

    try {
      setLoading(true);
      clearFeedback();
      await requestPasswordReset(normalizedEmail);
      Alert.alert("Reset email sent", "If the account exists, a password reset email has been sent.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not send reset email.";
      setFieldErrors({ general: message });
    } finally {
      setLoading(false);
    }
  }, [email, requestPasswordReset]);

  const handleResendConfirmation = useCallback(async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !/\S+@\S+\.\S+/.test(normalizedEmail)) {
      setFieldErrors((current) => ({
        ...current,
        email: "Enter the email you signed up with.",
      }));
      return;
    }

    try {
      setLoading(true);
      await resendSignupConfirmation(normalizedEmail);
      setNotice("A new confirmation email was requested. Check your inbox and spam folder.");
    } catch (error) {
      setFieldErrors({
        general:
          error instanceof Error
            ? error.message
            : "Could not resend the confirmation email.",
      });
    } finally {
      setLoading(false);
    }
  }, [email, resendSignupConfirmation]);

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

  const switchTab = (tab: "signin" | "signup") => {
    if (loading) return;
    setActiveTab(tab);
    clearFeedback();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NEU.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: 16,
            paddingBottom: 32,
            paddingHorizontal: 24,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back + Header */}
          <View style={{ marginBottom: 30 }}>
            <TextAction
              label="Back"
              onPress={() => {
                if (loading) return;
                hapticLight();
                if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  navigation.navigate("Onboarding");
                }
              }}
              disabled={loading}
              containerStyle={{ marginBottom: 22, alignSelf: "flex-start" }}
            />
            <Text
              style={{
                fontFamily: NEU_FONTS.heading,
                fontSize: 30,
                color: NEU.textPrimary,
                letterSpacing: -0.3,
                marginBottom: 6,
              }}
            >
              {activeTab === "signup" ? "Create your account" : "Welcome back"}
            </Text>
            <Text
              style={{
                fontFamily: NEU_FONTS.body,
                fontSize: 16,
                color: NEU.textSecondary,
                lineHeight: 23,
              }}
            >
              {activeTab === "signup"
                ? "Your goals and sessions, safe across devices."
                : "Sign in to continue where you left off."}
            </Text>
          </View>

          {/* Tabs */}
          <AuthTabs activeTab={activeTab} onSelect={switchTab} disabled={loading} />

          {/* General error */}
          {fieldErrors.general ? (
            <View
              style={{
                backgroundColor: NEU.card,
                borderRadius: NEU.radiusSmall,
                paddingVertical: 12,
                paddingHorizontal: 16,
                marginBottom: 16,
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

          {notice ? (
            <View
              style={{
                backgroundColor: NEU.card,
                borderRadius: NEU.radiusSmall,
                paddingVertical: 12,
                paddingHorizontal: 16,
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  fontFamily: NEU_FONTS.body,
                  fontSize: 14,
                  color: NEU.textSecondary,
                  textAlign: "center",
                }}
              >
                {notice}
              </Text>

              <TextAction
                label="Resend confirmation email"
                align="center"
                disabled={loading}
                onPress={() => void handleResendConfirmation()}
                containerStyle={{ alignSelf: "center", marginTop: 4 }}
              />
            </View>
          ) : null}

          {/* Sign Up: first name field */}
          {activeTab === "signup" && (
            <AuthInput
              placeholder="First name"
              value={firstName}
              onChangeText={(t) => {
                setFirstName(t);
                if (fieldErrors.firstName) setFieldErrors((p) => ({ ...p, firstName: undefined }));
                if (fieldErrors.general || notice) clearFeedback();
              }}
              autoCapitalize="words"
              error={fieldErrors.firstName}
            />
          )}

          {/* Email */}
          <AuthInput
            placeholder="Email address"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
              if (fieldErrors.general || notice) clearFeedback();
            }}
            keyboardType="email-address"
            error={fieldErrors.email}
          />

          {/* Password with show/hide */}
          <AuthInput
            placeholder="Password"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
              if (fieldErrors.general || notice) clearFeedback();
            }}
            secureTextEntry={!showPassword}
            showToggle
            onToggleSecure={() => setShowPassword(!showPassword)}
            error={fieldErrors.password}
          />

          {/* Forgot password (sign in only) */}
          {activeTab === "signin" && (
            <View style={{ alignItems: "flex-end", marginTop: 0, marginBottom: 26 }}>
              <TextAction
                label={loading ? "Please wait..." : "Forgot password?"}
                align="right"
                onPress={() => void handleForgotPassword()}
                disabled={loading}
                containerStyle={{ width: 160 }}
                textStyle={{ fontSize: 14, color: NEU.textSecondary }}
              />
            </View>
          )}

          {/* Submit button */}
          <AuthSubmitButton
            label={
              loading
                ? "Please wait..."
                : activeTab === "signin"
                  ? "Sign In"
                  : "Create account"
            }
            onPress={() => void handleSubmit()}
            disabled={loading}
          />

          <View
            style={{
              flexGrow: 1,
              minHeight: 220,
              justifyContent: "center",
              paddingTop: 24,
            }}
          >
            {/* Divider */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 30,
              }}
            >
              <View style={{ flex: 1, height: 1, backgroundColor: NEU.track }} />
              <Text
                style={{
                  fontFamily: NEU_FONTS.body,
                  fontSize: 13,
                  color: NEU.textSecondary,
                  marginHorizontal: 16,
                }}
              >
                or continue with
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: NEU.track }} />
            </View>

            {/* OAuth Buttons */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
                gap: 34,
              }}
            >
              {Platform.OS === "ios" && (
                <SocialAuthButton
                  provider="apple"
                  onPress={() => void handleAppleSignIn()}
                  disabled={loading}
                />
              )}
              <SocialAuthButton
                provider="google"
                onPress={() => void handleGoogleSignIn()}
                disabled={loading}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
