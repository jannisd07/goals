import React, { useMemo, useRef, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQueryClient } from "@tanstack/react-query";
import type { RootStackParamList } from "../navigation/types";
import { useAppStore } from "../store";
import { currentUser, supabase } from "../lib/supabase";
import { hapticMedium } from "../lib/haptics";
import { CategoryCards, ValueStepper } from "../components/CategoryCards";
import { PrimaryButton } from "../components/ui/PrimaryButton";
import { TextAction } from "../components/ui/TextAction";
import { MinimalTextInput } from "../components/ui/MinimalTextInput";
import { FOCUS_CATEGORIES, type Goal } from "../types";
import { NEU_FONTS } from "../theme/neumorphism";
import { PAPER } from "../theme/paper";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function SetupStudyingScreen() {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const savingRef = useRef(false);
  const goals = useAppStore((s) => s.goals);
  const setGoals = useAppStore((s) => s.setGoals);

  const focusGoal = useMemo(() => goals.find((g) => g.type === "focus") ?? null, [goals]);

  const initialCategoryKey = focusGoal?.category ?? "studying";
  const initialCategoryLabel =
    FOCUS_CATEGORIES.find((category) => category.key === initialCategoryKey)?.label ??
    "Deep Work";
  const [goalName, setGoalName] = useState(focusGoal?.name ?? initialCategoryLabel);
  const nameWasEditedRef = useRef(Boolean(focusGoal?.name));
  const [categoryKey, setCategoryKey] = useState<string | null>(initialCategoryKey);
  const [hours, setHours] = useState(focusGoal?.target_hours_per_week ?? 8);
  const [saving, setSaving] = useState(false);

  const handleDone = useCallback(async () => {
    if (savingRef.current) return;
    const normalizedGoalName = goalName.trim();
    if (!normalizedGoalName) {
      Alert.alert("Name your goal", "Enter a name to show on Home and in the timer.");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    let requestUserId: string | null = null;

    try {
      const user = await currentUser();
      if (!user) throw new Error("Not authenticated. Please sign in again.");
      requestUserId = user.id;

      const goalFields = {
        name: normalizedGoalName,
        type: "focus" as const,
        category: categoryKey,
        target_sessions_per_week: 0,
        target_hours_per_week: hours,
        color: "blue" as const,
        location: null,
        pomodoro_duration_minutes: 25,
        is_active: true,
      };

      const { data: serverGoal, error: lookupError } = await supabase
        .from("goals")
        .select("id")
        .eq("user_id", user.id)
        .eq("type", "focus")
        // A goal that was switched off is reused rather than replaced: it still
        // owns every session ever logged against it, and setting it up again is
        // meant to bring that goal back, not start a second one beside it.
        .order("is_active", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lookupError) throw lookupError;

      let savedGoal: Goal;
      if (serverGoal) {
        const { data, error } = await supabase
          .from("goals")
          .update({ ...goalFields, updated_at: new Date().toISOString() })
          .eq("id", serverGoal.id)
          .eq("user_id", user.id)
          .select()
          .single();
        if (error) throw error;
        savedGoal = data as Goal;
      } else {
        const { data, error } = await supabase
          .from("goals")
          .insert({ user_id: user.id, ...goalFields })
          .select()
          .single();
        if (error) throw error;
        savedGoal = data as Goal;
      }

      const current = useAppStore.getState();
      if (!current.isAuthenticated || current.userConfig?.id !== user.id) return;
      const nextGoals = [
        ...current.goals.filter((goal) => goal.type !== "focus"),
        savedGoal,
      ];
      setGoals(nextGoals);
      queryClient.setQueryData<Goal[]>(["goals"], nextGoals);
      hapticMedium();
      navigation.goBack();
    } catch (error) {
      const current = useAppStore.getState();
      if (
        !current.isAuthenticated ||
        (requestUserId && current.userConfig?.id !== requestUserId)
      ) {
        return;
      }
      const message =
        error instanceof Error
          ? error.message
          : error &&
              typeof error === "object" &&
              "message" in error &&
              typeof error.message === "string"
            ? error.message
            : "Please try again.";
      Alert.alert("Error", `Failed to save goal. ${message}`);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [categoryKey, goalName, hours, navigation, queryClient, setGoals]);

  const handleCategorySelect = useCallback(
    (category: (typeof FOCUS_CATEGORIES)[number]) => {
      setCategoryKey(category.key);
      if (!nameWasEditedRef.current) {
        setGoalName(category.label);
      }
    },
    [],
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.headerRow}>
        <TextAction
          label="Cancel"
          onPress={() => navigation.goBack()}
          disabled={saving}
          textStyle={{ color: PAPER.accentInk }}
        />
      </View>

      <ScrollView
          bounces={false}
          alwaysBounceVertical={false}
        style={styles.flex1}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>
          {focusGoal ? "Edit Focus Goal" : "Set up Focus Goal"}
        </Text>
        <Text style={styles.subtitle}>
          Give your focus goal a clear name, category, and weekly target.
        </Text>

        <Text style={styles.sectionLabel}>Goal name</Text>
        <MinimalTextInput
          value={goalName}
          onChangeText={(value) => {
            nameWasEditedRef.current = true;
            setGoalName(value);
          }}
          placeholder="Deep Work"
          accessibilityLabel="Focus goal name"
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={40}
          returnKeyType="done"
        />
        <Text style={styles.fieldHelp}>Shown on Home and in the focus timer.</Text>

        <Text style={styles.sectionLabel}>Category</Text>
        <CategoryCards
          categories={FOCUS_CATEGORIES}
          selectedKey={categoryKey}
          onSelect={handleCategorySelect}
        />

        <Text style={styles.sectionLabel}>Weekly target</Text>
        <ValueStepper
          value={hours}
          onChange={setHours}
          min={1}
          max={40}
          unit="hours / week"
          accessibilityLabel="Weekly focus hours"
        />
      </ScrollView>

      <View style={styles.bottomSection}>
        <PrimaryButton
          label={saving ? "Please wait..." : "Save"}
          onPress={() => void handleDone()}
          disabled={saving}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAPER.page,
  },
  flex1: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingTop: 12,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 28,
  },
  title: {
    color: PAPER.ink,
    fontSize: 28,
    fontFamily: NEU_FONTS.heading,
    letterSpacing: -0.3,
  },
  subtitle: {
    color: PAPER.inkMuted,
    fontSize: 16,
    fontFamily: NEU_FONTS.body,
    lineHeight: 23,
    marginTop: 8,
    marginBottom: 20,
  },
  sectionLabel: {
    color: PAPER.inkFaint,
    fontSize: 11,
    fontFamily: NEU_FONTS.label,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 10,
    marginBottom: 14,
  },
  fieldHelp: {
    color: PAPER.inkMuted,
    fontSize: 13,
    fontFamily: NEU_FONTS.body,
    lineHeight: 18,
    marginTop: 8,
    marginBottom: 8,
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
});
