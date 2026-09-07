import React, { useCallback, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MinimalTextInput } from "../components/ui/MinimalTextInput";
import { TextAction } from "../components/ui/TextAction";
import { supabase } from "../lib/supabase";
import { hapticSuccess } from "../lib/haptics";
import { useAppStore } from "../store";
import { NEU, NEU_FONTS } from "../theme/neumorphism";

export function PasswordResetScreen() {
  const setPasswordRecovery = useAppStore((state) => state.setPasswordRecovery);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      hapticSuccess();
      setPasswordRecovery(false);
      Alert.alert("Password updated", "You can now use your new password.");
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "The password could not be updated. Request a new link and try again.",
      );
    } finally {
      setSaving(false);
    }
  }, [confirmation, password, setPasswordRecovery]);

  const handleCancel = useCallback(async () => {
    if (saving) return;
    await supabase.auth.signOut({ scope: "local" }).catch(() => null);
    setPasswordRecovery(false);
  }, [saving, setPasswordRecovery]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NEU.bg }}>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 20 }}>
        <TextAction
          label="Cancel"
          disabled={saving}
          onPress={() => void handleCancel()}
          containerStyle={{ alignSelf: "flex-start" }}
        />

        <View style={{ flex: 1, justifyContent: "center", paddingBottom: 60 }}>
          <Text
            style={{
              color: NEU.textPrimary,
              fontFamily: NEU_FONTS.heading,
              fontSize: 30,
              letterSpacing: -0.3,
            }}
          >
            Choose a new password
          </Text>
          <Text
            style={{
              color: NEU.textSecondary,
              fontFamily: NEU_FONTS.body,
              fontSize: 16,
              lineHeight: 23,
              marginTop: 8,
              marginBottom: 26,
            }}
          >
            Your reset link is verified. Enter the new password twice to finish.
          </Text>

          <MinimalTextInput
            accessibilityLabel="New password"
            placeholder="New password"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setError(null);
            }}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            error={Boolean(error)}
            containerStyle={{ marginBottom: 14 }}
            rightAccessory={
              <TextAction
                label={showPassword ? "Hide" : "Show"}
                onPress={() => setShowPassword((visible) => !visible)}
                textStyle={{ fontSize: 13, color: NEU.textSecondary }}
              />
            }
          />
          <MinimalTextInput
            accessibilityLabel="Confirm new password"
            placeholder="Confirm new password"
            value={confirmation}
            onChangeText={(value) => {
              setConfirmation(value);
              setError(null);
            }}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            error={Boolean(error)}
          />

          {error ? (
            <Text
              accessibilityRole="alert"
              style={{
                color: NEU.textPrimary,
                fontFamily: NEU_FONTS.body,
                fontSize: 14,
                lineHeight: 20,
                marginTop: 10,
              }}
            >
              {error}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save new password"
            accessibilityState={{ disabled: saving }}
            disabled={saving}
            onPress={() => void handleSave()}
            style={({ pressed }) => ({
              minHeight: 56,
              borderRadius: NEU.radius,
              backgroundColor: NEU.textPrimary,
              alignItems: "center",
              justifyContent: "center",
              marginTop: 26,
              opacity: saving ? 0.45 : pressed ? 0.82 : 1,
            })}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontFamily: NEU_FONTS.label,
                fontSize: 17,
              }}
            >
              {saving ? "Saving…" : "Save password"}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
