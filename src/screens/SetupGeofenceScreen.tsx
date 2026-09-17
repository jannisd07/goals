import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQueryClient } from "@tanstack/react-query";
import MapView, {
  Circle as MapCircle,
  Marker,
  type MapPressEvent,
} from "react-native-maps";
import type { RootStackParamList } from "../navigation/types";
import { useAppStore } from "../store";
import { currentUser, supabase } from "../lib/supabase";
import {
  GEOFENCE_RADIUS_OPTIONS,
  getUserPlaceSearchContext,
  resolveUserPlaceSearchContext,
  searchPlaces,
  type PlaceSearchContext,
  type PlaceSuggestion,
} from "../lib/placeSearch";
import { hapticMedium } from "../lib/haptics";
import {
  DEFAULT_MIN_VISIT_MINUTES,
  MIN_VISIT_MINUTES_OPTIONS,
  formatMinVisitDuration,
  normalizeMinVisitMinutes,
} from "../types";
import { PrimaryButton } from "../components/ui/PrimaryButton";
import { TextAction } from "../components/ui/TextAction";
import { MinimalTextInput } from "../components/ui/MinimalTextInput";
import { NeumorphicSurface } from "../components/NeumorphicSurface";
import { PAPER } from "../theme/paper";
import { regionForRadius } from "../lib/mapRegion";
import { CategoryCards, ValueStepper } from "../components/CategoryCards";
import { CHECKIN_CATEGORIES, type Goal } from "../types";
import { NEU, NEU_FONTS } from "../theme/neumorphism";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function SetupGeofenceScreen() {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const searchRequestRef = useRef(0);
  const savingRef = useRef(false);
  const mapRef = useRef<MapView>(null);
  const goals = useAppStore((s) => s.goals);
  const setGoals = useAppStore((s) => s.setGoals);
  const pendingOnboarding = useAppStore((s) => s.pendingOnboarding);
  const setPendingOnboarding = useAppStore((s) => s.setPendingOnboarding);
  const setPermissionGateDismissed = useAppStore((s) => s.setPermissionGateDismissed);

  const checkinGoal = goals.find((g) => g.type === "physical") ?? null;
  const existingPlace: PlaceSuggestion | null = checkinGoal?.location
    ? {
        title: checkinGoal.name,
        displayName: checkinGoal.location.address,
        latitude: checkinGoal.location.latitude,
        longitude: checkinGoal.location.longitude,
        hasExplicitName: true,
      }
    : null;

  const [searchQuery, setSearchQuery] = useState(existingPlace?.displayName ?? "");
  const [searchResults, setSearchResults] = useState<PlaceSuggestion[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(existingPlace);
  const [searching, setSearching] = useState(false);
  const [searchContext, setSearchContext] = useState<PlaceSearchContext>(
    getUserPlaceSearchContext,
  );
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [categoryKey, setCategoryKey] = useState<string | null>(
    checkinGoal?.category ?? pendingOnboarding?.checkin_category ?? "gym",
  );
  const [sessionsPerWeek, setSessionsPerWeek] = useState(
    checkinGoal?.target_sessions_per_week ??
      pendingOnboarding?.checkin_target_sessions ??
      3,
  );
  const [radius, setRadius] = useState(checkinGoal?.location?.radius_meters ?? 30);

  // Keep the detection circle framed when the radius changes or the pin moves.
  useEffect(() => {
    if (!selectedPlace) return;
    mapRef.current?.animateToRegion(
      regionForRadius(selectedPlace.latitude, selectedPlace.longitude, radius),
      300,
    );
  }, [radius, selectedPlace]);
  const [minVisitMinutes, setMinVisitMinutes] = useState(
    normalizeMinVisitMinutes(
      checkinGoal?.min_visit_minutes ??
        pendingOnboarding?.checkin_min_visit_minutes ??
        DEFAULT_MIN_VISIT_MINUTES,
    ),
  );
  const [saving, setSaving] = useState(false);

  const pinCoordinate = useCallback((latitude: number, longitude: number) => {
    setSelectedPlace((current) => ({
      title: current?.title ?? "Pinned location",
      displayName:
        current?.displayName ?? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      latitude,
      longitude,
      hasExplicitName: Boolean(current?.hasExplicitName),
      countryCode: current?.countryCode,
      isLocalCountry: current?.isLocalCountry,
    }));
  }, []);

  const handleMapPress = useCallback(
    (event: MapPressEvent) => {
      pinCoordinate(
        event.nativeEvent.coordinate.latitude,
        event.nativeEvent.coordinate.longitude,
      );
      hapticMedium();
    },
    [pinCoordinate],
  );

  const runPlaceSearch = useCallback(async (
    queryInput: string,
    showEmptyAlert = false,
    worldwide = false,
  ) => {
    if (searching) return;
    const query = queryInput.trim();
    if (!query) {
      searchRequestRef.current += 1;
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    setSearching(true);

    try {
      const resolvedContext = await resolveUserPlaceSearchContext(searchContext);
      setSearchContext(resolvedContext);
      const mapped = await searchPlaces(
        query,
        resolvedContext,
        worldwide ? "worldwide" : "country",
      );
      if (searchRequestRef.current !== requestId) return;

      setSearchResults(mapped);
      // Never silently pin the first result. A wrong automatic selection is much
      // harder to notice than one explicit tap on the correct address.
      setSelectedPlace(null);

      if (mapped.length === 0) {
        if (showEmptyAlert) {
          Alert.alert(
            resolvedContext.countryCode
              ? `No results in ${resolvedContext.countryName ?? "your country"}`
              : "No results",
            resolvedContext.countryCode
              ? "Try a more specific address, or search worldwide."
              : "Try a more specific place or address.",
            resolvedContext.countryCode
              ? [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Search Worldwide",
                    onPress: () => void runPlaceSearch(query, false, true),
                  },
                ]
              : undefined,
          );
        }
      }
    } catch {
      if (searchRequestRef.current !== requestId) return;
      if (showEmptyAlert) {
        Alert.alert("Search unavailable", "Could not search places right now. Please try again.");
      }
      setSearchResults([]);
    } finally {
      if (searchRequestRef.current === requestId) {
        setSearching(false);
      }
    }
  }, [searchContext, searching]);

  const handleSearchPlaces = useCallback(async () => {
    const query = searchQuery.trim();
    if (!query) {
      Alert.alert("Search Required", "Please enter a place name or address.");
      return;
    }

    await runPlaceSearch(query, true);
  }, [searchQuery, runPlaceSearch]);

  const resolveSelectedPlace = useCallback(() => {
    return selectedPlace;
  }, [selectedPlace]);

  const handleNextStep = useCallback(() => {
    const finalPlace = resolveSelectedPlace();
    if (!finalPlace) {
      Alert.alert(
        "Location Required",
        "Please search, then choose the correct place from the results.",
      );
      return;
    }

    setCurrentStep(2);
  }, [resolveSelectedPlace]);

  const handleDone = useCallback(async () => {
    if (savingRef.current) return;

    const finalPlace = resolveSelectedPlace();

    if (!finalPlace) {
      Alert.alert(
        "Location Required",
        "Please search, then choose the correct place from the results.",
      );
      return;
    }

    if (!categoryKey) {
      Alert.alert("Category Required", "Please choose what this place is for.");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    let requestUserId: string | null = null;

    try {
      const user = await currentUser();
      if (!user) throw new Error("Not authenticated. Please sign in again.");
      requestUserId = user.id;

      // The category label becomes the goal name — and with it the card title on Home.
      const categoryLabel =
        CHECKIN_CATEGORIES.find((c) => c.key === categoryKey)?.label ?? "Auto Check-In";
      const goalFields = {
        name: categoryLabel,
        type: "physical" as const,
        category: categoryKey,
        target_sessions_per_week: sessionsPerWeek,
        target_hours_per_week: 0,
        color: "blue" as const,
        location: {
          latitude: finalPlace.latitude,
          longitude: finalPlace.longitude,
          radius_meters: radius,
          address: finalPlace.displayName,
        },
        min_visit_minutes: minVisitMinutes,
        pomodoro_duration_minutes: 25,
        is_active: true,
      };

      const { data: serverGoal, error: lookupError } = await supabase
        .from("goals")
        .select("id")
        .eq("user_id", user.id)
        .eq("type", "physical")
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
          .update({
            ...goalFields,
            updated_at: new Date().toISOString(),
          })
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
        ...current.goals.filter((goal) => goal.type !== "physical"),
        savedGoal,
      ];
      setGoals(nextGoals);
      queryClient.setQueryData<Goal[]>(["goals"], nextGoals);
      // A newly configured location should immediately lead into activation if
      // Always permission is still missing. Otherwise the card looks enabled
      // while no geofence can actually run.
      setPermissionGateDismissed(false);

      // Onboarding check-in prefs are consumed now.
      if (pendingOnboarding) setPendingOnboarding(null);

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
  }, [
    resolveSelectedPlace,
    categoryKey,
    sessionsPerWeek,
    radius,
    minVisitMinutes,
    navigation,
    pendingOnboarding,
    queryClient,
    setGoals,
    setPendingOnboarding,
    setPermissionGateDismissed,
  ]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.headerRow}>
        {currentStep === 2 ? (
          <TextAction
            label="Back"
            onPress={() => setCurrentStep(1)}
            disabled={saving}
            textStyle={{ color: PAPER.accentInk }}
          />
        ) : (
          <View style={{ width: 72 }} />
        )}

        <View pointerEvents="none" style={styles.headerDotsOverlay}>
          {[1, 2].map((step) => {
            const active = currentStep === step;
            return <View key={step} style={[styles.stepDot, active && styles.stepDotActive]} />;
          })}
        </View>

        {currentStep === 2 ? (
          <TextAction
            label={saving ? "Please wait..." : "Save"}
            align="right"
            onPress={handleDone}
            disabled={saving}
            textStyle={{ color: PAPER.accentInk }}
          />
        ) : (
          <TextAction
            label="Close"
            align="right"
            onPress={() => navigation.goBack()}
            textStyle={{ color: PAPER.accentInk }}
          />
        )}
      </View>

      <ScrollView
          bounces={false}
          alwaysBounceVertical={false}
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>
          {checkinGoal ? "Edit Auto Check-In" : "Set up Auto Check-In"}
        </Text>

        {currentStep === 1 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Search location</Text>

            <View style={styles.searchRow}>
              <MinimalTextInput
                value={searchQuery}
                onChangeText={(value) => {
                  searchRequestRef.current += 1;
                  setSearchQuery(value);
                  setSearchResults([]);
                  setSearching(false);
                  if (selectedPlace && value.trim() !== selectedPlace.displayName) {
                    setSelectedPlace(null);
                  }
                }}
                placeholder="e.g. Orange Gym Ulm or full address"
                style={styles.textInput}
                containerStyle={{ flex: 1 }}
                autoCapitalize="words"
                autoCorrect={false}
                onSubmitEditing={handleSearchPlaces}
                returnKeyType="search"
              />
              <Pressable
                onPress={handleSearchPlaces}
                disabled={searching}
                accessibilityRole="button"
                accessibilityLabel="Search places"
                accessibilityState={{ disabled: searching }}
                style={({ pressed }) => [
                  styles.searchButton,
                  { transform: [{ scale: pressed ? 0.98 : 1 }] },
                ]}
              >
                {searching ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.searchButtonText}>Search</Text>
                )}
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="OpenStreetMap contributor attribution"
              onPress={() => void Linking.openURL("https://www.openstreetmap.org/copyright")}
              style={{ alignSelf: "flex-end", paddingVertical: 8 }}
            >
              <Text style={styles.attribution}>Search © OpenStreetMap contributors</Text>
            </Pressable>

            {searchResults.length > 0 ? (
              <Text style={styles.searchScope}>
                {!searchContext.countryCode
                  ? "Worldwide results"
                  : searchResults.some((result) => result.isLocalCountry)
                    ? `Results in ${searchContext.countryName ?? "your country"}`
                    : `No matches in ${searchContext.countryName ?? "your country"} · showing worldwide results`}
              </Text>
            ) : null}

            {searchResults.length > 0 ? (
              <NeumorphicSurface radius={NEU.radiusLarge} contentPadding={8}>
                {searchResults.map((item, index) => {
                  const active = selectedPlace?.displayName === item.displayName;
                  return (
                    <Pressable
                      key={`${item.displayName}-${item.latitude}-${item.longitude}`}
                      onPress={() => {
                        searchRequestRef.current += 1;
                        setSelectedPlace(item);
                        setSearching(false);
                        hapticMedium();
                        setCurrentStep(2);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={({ pressed }) => [
                        styles.resultItem,
                        index > 0 && styles.resultItemSpacing,
                        { opacity: pressed ? 0.6 : 1 },
                      ]}
                    >
                      <Text style={[styles.resultTitle, active && styles.resultTitleActive]}>
                        {item.title}
                      </Text>
                      <Text style={styles.resultAddress} numberOfLines={2}>
                        {item.displayName}
                      </Text>
                    </Pressable>
                  );
                })}
              </NeumorphicSurface>
            ) : null}
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>What is it for?</Text>
              <CategoryCards
                categories={CHECKIN_CATEGORIES}
                selectedKey={categoryKey}
                onSelect={(category) => {
                  setCategoryKey(category.key);
                  hapticMedium();
                }}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Weekly visit goal</Text>
              <ValueStepper
                value={sessionsPerWeek}
                onChange={setSessionsPerWeek}
                min={1}
                max={14}
                unit="visits / week"
                accessibilityLabel="Weekly visit target"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Radius</Text>

              <View style={styles.pillRow}>
                {GEOFENCE_RADIUS_OPTIONS.map((opt) => {
                  const active = radius === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => {
                        setRadius(opt.value);
                        hapticMedium();
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`Radius ${opt.label}`}
                      style={styles.pillTouch}
                    >
                      <View style={[styles.pill, active && styles.pillActive]}>
                        <Text style={[styles.pillText, active && styles.pillTextActive]}>
                          {opt.label}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              {selectedPlace ? (
                <>
                  <View style={styles.mapContainer}>
                    <MapView
                      ref={mapRef}
                      style={StyleSheet.absoluteFill}
                      initialRegion={regionForRadius(
                        selectedPlace.latitude,
                        selectedPlace.longitude,
                        radius,
                      )}
                      onPress={handleMapPress}
                      pitchEnabled={false}
                      rotateEnabled={false}
                      accessibilityLabel="Map showing the Auto Check-In detection radius"
                    >
                      <MapCircle
                        center={{
                          latitude: selectedPlace.latitude,
                          longitude: selectedPlace.longitude,
                        }}
                        radius={radius}
                        fillColor={`rgba(${NEU.accentRgb}, 0.16)`}
                        strokeColor={NEU.accent}
                        strokeWidth={2}
                      />
                      <Marker
                        coordinate={{
                          latitude: selectedPlace.latitude,
                          longitude: selectedPlace.longitude,
                        }}
                        draggable
                        pinColor={NEU.accent}
                        onDragEnd={(event) => {
                          pinCoordinate(
                            event.nativeEvent.coordinate.latitude,
                            event.nativeEvent.coordinate.longitude,
                          );
                        }}
                      />
                    </MapView>
                  </View>
                  <Text style={styles.mapHint}>
                    The highlighted circle is the {radius}m detection area. Tap
                    the map or drag the pin to align it with the entrance.
                  </Text>
                </>
              ) : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Minimum stay</Text>
              <View style={styles.pillRow}>
                {MIN_VISIT_MINUTES_OPTIONS.map((opt) => {
                  const active = minVisitMinutes === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => {
                        setMinVisitMinutes(opt.value);
                        hapticMedium();
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`Minimum stay ${opt.label}`}
                      style={styles.pillTouch}
                    >
                      <View style={[styles.pill, active && styles.pillActive]}>
                        <Text style={[styles.pillText, active && styles.pillTextActive]}>
                          {opt.label}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.mapHint}>
                Visits shorter than {formatMinVisitDuration(minVisitMinutes)} are discarded, so
                walking past this place never becomes a session.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.bottomSection}>
        {currentStep === 1 ? (
          <PrimaryButton label="Next" onPress={handleNextStep} />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAPER.page,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerDotsOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PAPER.line,
  },
  stepDotActive: {
    backgroundColor: NEU.accent,
  },
  title: {
    color: PAPER.ink,
    fontSize: 28,
    fontFamily: NEU_FONTS.heading,
    letterSpacing: -0.3,
    marginBottom: 20,
  },

  section: {
    marginBottom: 28,
  },
  mapContainer: {
    height: 220,
    marginTop: 14,
    borderRadius: NEU.radiusLarge,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: PAPER.line,
    backgroundColor: PAPER.surface,
  },
  mapHint: {
    color: PAPER.inkMuted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: NEU_FONTS.body,
    marginTop: 8,
  },
  sectionLabel: {
    color: PAPER.inkFaint,
    fontSize: 11,
    fontFamily: NEU_FONTS.label,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 14,
  },

  searchRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  searchButton: {
    backgroundColor: NEU.accent,
    borderRadius: NEU.radiusSmall,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 84,
    minHeight: NEU.hitTarget,
  },
  searchButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: NEU_FONTS.label,
  },
  attribution: {
    color: PAPER.inkFaint,
    fontSize: 11,
    fontFamily: NEU_FONTS.body,
  },
  searchScope: {
    color: PAPER.inkMuted,
    fontSize: 12,
    fontFamily: NEU_FONTS.label,
    marginBottom: 8,
  },
  resultItem: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: NEU.hitTarget,
    justifyContent: "center",
  },
  resultItemSpacing: {
    marginTop: 2,
  },
  resultTitle: {
    color: NEU.textPrimary,
    fontSize: 16,
    fontFamily: NEU_FONTS.label,
    marginBottom: 2,
  },
  resultTitleActive: {
    color: NEU.accent,
  },
  resultAddress: {
    color: NEU.textSecondary,
    fontSize: 13,
    fontFamily: NEU_FONTS.body,
    lineHeight: 18,
  },

  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  pillTouch: {
    minHeight: NEU.hitTarget,
    justifyContent: "center",
  },
  pill: {
    paddingHorizontal: 24,
    height: 38,
    borderRadius: PAPER.radiusSm,
    borderWidth: 1,
    borderColor: PAPER.line,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PAPER.surface,
  },
  // Same selection language as Stats: the pill stays light, only the outline
  // and label turn green.
  pillActive: {
    borderColor: PAPER.accent,
    backgroundColor: PAPER.accentWash,
  },
  pillText: {
    color: PAPER.inkMuted,
    fontSize: 15,
    fontFamily: NEU_FONTS.label,
  },
  pillTextActive: {
    color: PAPER.accentInk,
    fontFamily: NEU_FONTS.heading,
  },

  textInput: {
    // Typed text sits inside the white search field, not on the artwork.
    color: NEU.textPrimary,
    fontSize: 16,
    height: 48,
    fontFamily: NEU_FONTS.body,
  },

  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
});
