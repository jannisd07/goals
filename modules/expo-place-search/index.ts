import { requireOptionalNativeModule } from "expo-modules-core";

export type NativePlaceSearchResult = {
  title: string;
  displayName: string;
  latitude: number;
  longitude: number;
  countryCode?: string;
};

type ExpoPlaceSearchNativeModule = {
  search(
    query: string,
    latitude: number | null,
    longitude: number | null,
    limit: number,
  ): Promise<NativePlaceSearchResult[]>;
};

const nativeModule =
  requireOptionalNativeModule<ExpoPlaceSearchNativeModule>("ExpoPlaceSearch");

export function isNativePlaceSearchAvailable(): boolean {
  return Boolean(nativeModule);
}

export async function searchNativePlaces(
  query: string,
  latitude: number | null,
  longitude: number | null,
  limit = 8,
): Promise<NativePlaceSearchResult[]> {
  if (!nativeModule) return [];
  return nativeModule.search(query, latitude, longitude, limit);
}
