import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { hapticSuccess } from "../lib/haptics";
import { MinimalTextInput } from "./ui/MinimalTextInput";
import { PopupCard } from "./ui/PopupCard";
import { PrimaryButton } from "./ui/PrimaryButton";
import { NEU_FONTS } from "../theme/neumorphism";
import { PAPER } from "../theme/paper";

/** Matches the users_display_name_valid CHECK in the database. */
const DISPLAY_NAME_MAX_LENGTH = 80;

interface DisplayNameSheetProps {
  visible: boolean;
  currentName: string;
  onSave: (name: string) => Promise<unknown>;
  onClose: () => void;
}

/** Popup for changing the name shown on Home and to friends. */
export function DisplayNameSheet({ visible, currentName, onSave, onClose }: DisplayNameSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Mounted only while open, so every opening starts from the saved name. */}
      {visible ? (
        <DisplayNameForm currentName={currentName} onSave={onSave} onClose={onClose} />
      ) : null}
    </Modal>
  );
}

function DisplayNameForm({
  currentName,
  onSave,
  onClose,
}: Omit<DisplayNameSheetProps, "visible">) {
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();

  const save = async () => {
    if (saving || trimmed.length === 0) return;
    if (trimmed === currentName.trim()) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(trimmed);
      hapticSuccess();
      onClose();
    } catch {
      setError("Your name could not be saved. Check your connection and try again.");
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.overlay}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={saving ? undefined : onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <View accessibilityViewIsModal style={styles.sheetWrap}>
        <PopupCard>
          <Text style={styles.title} accessibilityRole="header">
            Display name
          </Text>
          <Text style={styles.subtitle}>Shown on Home and to your friends.</Text>

          <MinimalTextInput
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (error) setError(null);
            }}
            placeholder="Your name"
            placeholderTextColor={PAPER.inkFaint}
            accessibilityLabel="Display name"
            autoFocus
            autoCapitalize="words"
            autoCorrect={false}
            textContentType="nickname"
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            returnKeyType="done"
            onSubmitEditing={() => void save()}
            editable={!saving}
            error={Boolean(error)}
            containerStyle={styles.input}
          />
          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : trimmed.length === 0 ? (
            <Text style={styles.hint}>Enter a name to save.</Text>
          ) : null}

          <PrimaryButton
            label={saving ? "Saving…" : "Save"}
            onPress={() => void save()}
            disabled={saving || trimmed.length === 0}
            containerStyle={styles.saveButton}
          />
          <Pressable
            onPress={onClose}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            accessibilityState={{ disabled: saving }}
            style={({ pressed }) => [styles.cancelButton, pressed && { opacity: 0.5 }]}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </PopupCard>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  sheetWrap: {
    width: "100%",
    maxWidth: 420,
  },
  title: {
    color: PAPER.ink,
    fontSize: 22,
    fontFamily: NEU_FONTS.heading,
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    color: PAPER.inkMuted,
    fontSize: 16,
    fontFamily: NEU_FONTS.body,
    textAlign: "center",
  },
  input: {
    marginTop: 20,
  },
  hint: {
    color: PAPER.inkMuted,
    fontSize: 13,
    fontFamily: NEU_FONTS.body,
    marginTop: 8,
  },
  error: {
    color: PAPER.danger,
    fontSize: 13,
    fontFamily: NEU_FONTS.body,
    marginTop: 8,
  },
  saveButton: {
    marginTop: 20,
  },
  cancelButton: {
    minHeight: PAPER.hitTarget,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginTop: 4,
  },
  cancelText: {
    color: PAPER.inkMuted,
    fontSize: 14,
    fontFamily: NEU_FONTS.body,
  },
});
