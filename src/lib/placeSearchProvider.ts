export const PUBLIC_NOMINATIM_SEARCH_ENDPOINT =
  "https://nominatim.openstreetmap.org/search";

export function buildSupabasePlaceSearchEndpoint(
  supabaseUrl: string | undefined,
): string | null {
  const configuredUrl = supabaseUrl?.trim();
  if (!configuredUrl) return null;

  try {
    const url = new URL(configuredUrl);
    if (url.protocol !== "https:") return null;
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/functions/v1/place-search`;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

/** Uses an explicit provider or the opt-in project proxy, then the dev fallback. */
export function resolvePlaceSearchEndpoint(
  configuredEndpoint: string | undefined,
  supabaseUrl?: string,
): string {
  const configured = configuredEndpoint?.trim() ?? "";
  if (configured.toLowerCase() === "supabase") {
    return (
      buildSupabasePlaceSearchEndpoint(supabaseUrl) ||
      PUBLIC_NOMINATIM_SEARCH_ENDPOINT
    );
  }
  return configured || PUBLIC_NOMINATIM_SEARCH_ENDPOINT;
}

/** Appends Nominatim-compatible parameters while preserving proxy query parameters. */
export function buildPlaceSearchUrl(
  endpoint: string,
  queryString: string,
): string {
  if (!queryString) return endpoint;
  const separator =
    endpoint.endsWith("?") || endpoint.endsWith("&")
      ? ""
      : endpoint.includes("?")
        ? "&"
        : "?";
  return `${endpoint}${separator}${queryString}`;
}

export function usesPublicNominatim(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return (
      url.protocol === "https:" &&
      url.hostname.toLowerCase() === "nominatim.openstreetmap.org"
    );
  } catch {
    return false;
  }
}

export function isTrustedSupabasePlaceSearchEndpoint(
  endpoint: string,
  supabaseUrl: string | undefined,
): boolean {
  const expectedEndpoint = buildSupabasePlaceSearchEndpoint(supabaseUrl);
  if (!expectedEndpoint) return false;

  try {
    const actual = new URL(endpoint);
    const expected = new URL(expectedEndpoint);
    return (
      actual.protocol === "https:" &&
      actual.origin === expected.origin &&
      actual.pathname.replace(/\/+$/, "") ===
        expected.pathname.replace(/\/+$/, "")
    );
  } catch {
    return false;
  }
}
