import { getLocales } from "expo-localization";
import * as Location from "expo-location";
import { Platform } from "react-native";
import {
  isNativePlaceSearchAvailable,
  searchNativePlaces,
} from "../../modules/expo-place-search";
import {
  buildPlaceSearchUrl,
  isTrustedSupabasePlaceSearchEndpoint,
  resolvePlaceSearchEndpoint,
  usesPublicNominatim,
} from "./placeSearchProvider";
import { supabase } from "./supabase";

export type PlaceSuggestion = {
  title: string;
  displayName: string;
  latitude: number;
  longitude: number;
  hasExplicitName: boolean;
  countryCode?: string | null;
  isLocalCountry?: boolean;
};

export type PlaceSearchContext = {
  countryCode: string | null;
  countryName: string | null;
  languageTag: string;
  source: "location" | "locale";
  latitude: number | null;
  longitude: number | null;
};

export type PlaceSearchScope = "country" | "worldwide";

export const GEOFENCE_RADIUS_OPTIONS = [
  { label: "15m", value: 15 },
  { label: "30m", value: 30 },
  { label: "70m", value: 70 },
] as const;

const ADDRESS_QUERY_HINT =
  /(\d|street|st\.|road|rd\.|avenue|ave\.|boulevard|blvd|lane|ln\.|drive|dr\.|strasse|straße|weg|gasse|platz|allee|,)/i;
const searchCache = new Map<string, PlaceSuggestion[]>();
let lastNominatimRequestAt = 0;
let resolvedContextCache:
  | { value: PlaceSearchContext; resolvedAt: number }
  | null = null;
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

async function respectNominatimRateLimit(): Promise<void> {
  const waitMs = Math.max(0, 1100 - (Date.now() - lastNominatimRequestAt));
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  lastNominatimRequestAt = Date.now();
}

export function isLikelyAddressQuery(query: string): boolean {
  return ADDRESS_QUERY_HINT.test(query.trim());
}

export function normalizeCountryCode(countryCode: string | null | undefined): string | null {
  const normalized = countryCode?.trim().toLowerCase() ?? "";
  return /^[a-z]{2}$/.test(normalized) ? normalized : null;
}

export function getUserPlaceSearchContext(): PlaceSearchContext {
  const primaryLocale = getLocales()[0];
  const languageTag =
    primaryLocale?.languageTag ||
    Intl.DateTimeFormat().resolvedOptions().locale ||
    "en";
  const countryCode = normalizeCountryCode(primaryLocale?.regionCode);

  let countryName: string | null = null;
  if (countryCode && typeof Intl.DisplayNames === "function") {
    try {
      countryName =
        new Intl.DisplayNames([languageTag], { type: "region" }).of(
          countryCode.toUpperCase(),
        ) ?? null;
    } catch {
      countryName = null;
    }
  }

  return {
    countryCode,
    countryName,
    languageTag,
    source: "locale",
    latitude: null,
    longitude: null,
  };
}

export async function resolveUserPlaceSearchContext(
  fallback = getUserPlaceSearchContext(),
): Promise<PlaceSearchContext> {
  if (
    resolvedContextCache &&
    Date.now() - resolvedContextCache.resolvedAt < 15 * 60 * 1000
  ) {
    return resolvedContextCache.value;
  }

  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) return fallback;

    const lastKnown = await Location.getLastKnownPositionAsync({
      maxAge: 30 * 60 * 1000,
      requiredAccuracy: 10_000,
    });
    const position =
      lastKnown ??
      (await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }));
    const [address] = await Location.reverseGeocodeAsync({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
    const countryCode = normalizeCountryCode(address?.isoCountryCode);
    if (!countryCode) return fallback;

    const resolved: PlaceSearchContext = {
      countryCode,
      countryName: address?.country?.trim() || fallback.countryName,
      languageTag: fallback.languageTag,
      source: "location",
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
    resolvedContextCache = { value: resolved, resolvedAt: Date.now() };
    return resolved;
  } catch {
    // Search must remain usable when GPS or the platform geocoder is
    // temporarily unavailable. Locale is a safe, non-global fallback.
    return fallback;
  }
}

type NominatimResult = {
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
  address?: {
    country_code?: string;
  };
};

function mapNominatimResults(
  data: NominatimResult[],
  query: string,
  localCountryCode: string | null,
): PlaceSuggestion[] {
  return (data ?? [])
    .map((item): PlaceSuggestion | null => {
      const latitude = Number(item.lat);
      const longitude = Number(item.lon);
      if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;

      const cleanName = item.name?.trim() ?? "";
      const fallbackTitle = item.display_name?.split(",")[0]?.trim() || query;
      const resultCountryCode = normalizeCountryCode(item.address?.country_code);

      return {
        title: (cleanName || fallbackTitle).slice(0, 40),
        displayName: item.display_name,
        latitude,
        longitude,
        hasExplicitName: Boolean(cleanName),
        countryCode: resultCountryCode,
        isLocalCountry: Boolean(
          localCountryCode && resultCountryCode === localCountryCode,
        ),
      };
    })
    .filter((value): value is PlaceSuggestion => Boolean(value));
}

async function fetchNominatimResults(
  query: string,
  context: PlaceSearchContext,
  countryCode: string | null,
): Promise<PlaceSuggestion[]> {
  const endpoint = resolvePlaceSearchEndpoint(
    process.env.EXPO_PUBLIC_PLACE_SEARCH_ENDPOINT,
    SUPABASE_URL,
  );
  const cacheKey = [
    endpoint,
    countryCode ?? "global",
    context.languageTag,
    query.toLocaleLowerCase(),
  ].join(":");
  const cached = searchCache.get(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    format: "jsonv2",
    q: query,
    limit: "8",
    addressdetails: "1",
    "accept-language": context.languageTag,
  });
  if (countryCode) {
    // Nominatim documents countrycodes as a hard ISO-3166-1 alpha-2 filter.
    // This makes the first result set genuinely local instead of merely
    // preferring an entire continent.
    params.set("countrycodes", countryCode);
  }
  if (
    context.latitude !== null &&
    context.longitude !== null &&
    Number.isFinite(context.latitude) &&
    Number.isFinite(context.longitude)
  ) {
    // Nominatim uses viewbox as a ranking preference when bounded=0. The hard
    // country filter remains authoritative, while nearby towns and businesses
    // rank ahead of same-named places hundreds of kilometres away.
    const latitudeSpan = 1.2;
    const longitudeSpan = 1.8;
    params.set(
      "viewbox",
      [
        context.longitude - longitudeSpan,
        context.latitude + latitudeSpan,
        context.longitude + longitudeSpan,
        context.latitude - latitudeSpan,
      ].join(","),
    );
    params.set("bounded", "0");
  }

  const isDirectNominatimRequest = usesPublicNominatim(endpoint);
  const isAuthenticatedProjectProxy =
    isTrustedSupabasePlaceSearchEndpoint(endpoint, SUPABASE_URL);
  if (isDirectNominatimRequest) {
    await respectNominatimRateLimit();
  }
  let authenticationHeaders: Record<string, string> = {};
  if (isAuthenticatedProjectProxy) {
    const { data, error } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (error || !accessToken || !SUPABASE_ANON_KEY) {
      throw new Error("Sign in is required to search for places");
    }
    authenticationHeaders = {
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
    };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let response: Response;
  try {
    response = await fetch(
      buildPlaceSearchUrl(endpoint, params.toString()),
      {
        headers: {
          Accept: "application/json",
          "Accept-Language": context.languageTag,
          ...(isDirectNominatimRequest
            ? { "User-Agent": "Goals/1.0 (com.goals.app)" }
            : {}),
          ...authenticationHeaders,
        },
        signal: controller.signal,
      },
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) throw new Error("Search failed");
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("Search provider returned an invalid response");
  }

  const results = mapNominatimResults(
    payload as NominatimResult[],
    query,
    context.countryCode,
  );

  if (searchCache.size >= 50) {
    const oldestKey = searchCache.keys().next().value as string | undefined;
    if (oldestKey) searchCache.delete(oldestKey);
  }
  searchCache.set(cacheKey, results);
  return results;
}

export async function searchPlaces(
  queryInput: string,
  context = getUserPlaceSearchContext(),
  scope: PlaceSearchScope = "country",
): Promise<PlaceSuggestion[]> {
  const query = queryInput.trim();
  if (!query) return [];

  if (Platform.OS === "ios" && isNativePlaceSearchAvailable()) {
    const cacheKey = [
      "apple-mapkit",
      scope,
      context.countryCode ?? "global",
      context.latitude?.toFixed(2) ?? "no-lat",
      context.longitude?.toFixed(2) ?? "no-lon",
      query.toLocaleLowerCase(),
    ].join(":");
    const cached = searchCache.get(cacheKey);
    if (cached) return cached;

    try {
      const nativeResults = await searchNativePlaces(
        query,
        context.latitude,
        context.longitude,
        10,
      );
      const mapped = nativeResults
        .map((item): PlaceSuggestion | null => {
          if (
            !Number.isFinite(item.latitude) ||
            !Number.isFinite(item.longitude)
          ) {
            return null;
          }
          const countryCode = normalizeCountryCode(item.countryCode);
          return {
            title: item.title.trim().slice(0, 60) || query,
            displayName: item.displayName.trim() || item.title.trim() || query,
            latitude: item.latitude,
            longitude: item.longitude,
            hasExplicitName: Boolean(item.title.trim()),
            countryCode,
            isLocalCountry: Boolean(
              context.countryCode && countryCode === context.countryCode,
            ),
          };
        })
        .filter((item): item is PlaceSuggestion => Boolean(item))
        .filter(
          (item) =>
            scope === "worldwide" ||
            !context.countryCode ||
            item.countryCode === context.countryCode,
        )
        .slice(0, 8);

      searchCache.set(cacheKey, mapped);
      return mapped;
    } catch (error) {
      console.warn("Apple place search unavailable; using fallback:", error);
    }
  }

  if (scope === "country" && context.countryCode) {
    return fetchNominatimResults(
      query,
      context,
      context.countryCode,
    );
  }

  // Worldwide search is explicit. A vague local query must never silently
  // replace a truthful empty state with an unrelated foreign result.
  return fetchNominatimResults(query, context, null);
}
