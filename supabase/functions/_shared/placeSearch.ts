export const PLACE_SEARCH_MAX_RESULTS = 8;
export const PLACE_SEARCH_MAX_QUERY_LENGTH = 120;

export type PlaceSearchRequest = {
  query: string;
  countryCode: string | null;
  language: string;
  limit: number;
};

export type PlaceSearchResult = {
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
  address?: {
    country_code?: string;
  };
};

export type PlaceSearchRequestResult =
  | { ok: true; value: PlaceSearchRequest }
  | { ok: false; error: string };

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const LANGUAGE_HEADER = /^[A-Za-z0-9,;=._ -]{1,64}$/;
const COUNTRY_CODE = /^[a-z]{2}$/;

export function parsePlaceSearchRequest(url: URL): PlaceSearchRequestResult {
  const query = (url.searchParams.get("q") ?? "").trim().normalize("NFKC");
  if (query.length < 2) {
    return { ok: false, error: "Search query must contain at least 2 characters." };
  }
  if (
    query.length > PLACE_SEARCH_MAX_QUERY_LENGTH ||
    CONTROL_CHARACTERS.test(query)
  ) {
    return { ok: false, error: "Search query is invalid." };
  }

  const requestedLimit = url.searchParams.get("limit");
  const limit = requestedLimit === null ? PLACE_SEARCH_MAX_RESULTS : Number(requestedLimit);
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > PLACE_SEARCH_MAX_RESULTS
  ) {
    return {
      ok: false,
      error: `Result limit must be between 1 and ${PLACE_SEARCH_MAX_RESULTS}.`,
    };
  }

  const rawCountryCode = url.searchParams.get("countrycodes")?.trim().toLowerCase() ?? "";
  if (rawCountryCode && !COUNTRY_CODE.test(rawCountryCode)) {
    return { ok: false, error: "Country code must be ISO 3166-1 alpha-2." };
  }

  const language = (
    url.searchParams.get("accept-language") ??
    url.searchParams.get("language") ??
    "en"
  ).trim();
  if (!LANGUAGE_HEADER.test(language)) {
    return { ok: false, error: "Language preference is invalid." };
  }

  return {
    ok: true,
    value: {
      query,
      countryCode: rawCountryCode || null,
      language,
      limit,
    },
  };
}

export function buildPlaceSearchCacheInput(request: PlaceSearchRequest): string {
  return JSON.stringify({
    q: request.query.toLocaleLowerCase("en-US"),
    countryCode: request.countryCode,
    language: request.language.toLocaleLowerCase("en-US"),
    limit: request.limit,
  });
}

export function buildNominatimUrl(
  request: PlaceSearchRequest,
  contactEmail?: string,
): URL {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", request.query);
  url.searchParams.set("limit", String(request.limit));
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", request.language);
  if (request.countryCode) {
    url.searchParams.set("countrycodes", request.countryCode);
  }
  if (contactEmail?.trim()) {
    url.searchParams.set("email", contactEmail.trim());
  }
  return url;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) return null;
  return normalized;
}

export function sanitizeNominatimResults(
  payload: unknown,
  limit: number,
): PlaceSearchResult[] | null {
  if (!Array.isArray(payload)) return null;

  const results: PlaceSearchResult[] = [];
  for (const item of payload) {
    if (!isRecord(item)) continue;

    const displayName = boundedString(item.display_name, 500);
    const latitude = boundedString(item.lat, 32);
    const longitude = boundedString(item.lon, 32);
    if (!displayName || !latitude || !longitude) continue;

    const numericLatitude = Number(latitude);
    const numericLongitude = Number(longitude);
    if (
      !Number.isFinite(numericLatitude) ||
      !Number.isFinite(numericLongitude) ||
      numericLatitude < -90 ||
      numericLatitude > 90 ||
      numericLongitude < -180 ||
      numericLongitude > 180
    ) {
      continue;
    }

    const result: PlaceSearchResult = {
      display_name: displayName,
      lat: latitude,
      lon: longitude,
    };
    const name = boundedString(item.name, 200);
    if (name) result.name = name;

    const address = isRecord(item.address) ? item.address : null;
    const countryCode = boundedString(address?.country_code, 2)?.toLowerCase();
    if (countryCode && COUNTRY_CODE.test(countryCode)) {
      result.address = { country_code: countryCode };
    }

    results.push(result);
    if (results.length >= limit) break;
  }
  return results;
}
