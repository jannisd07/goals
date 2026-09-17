import { createClient } from "npm:@supabase/supabase-js@2.100.0";
import {
  buildNominatimUrl,
  buildPlaceSearchCacheInput,
  parsePlaceSearchRequest,
  sanitizeNominatimResults,
  type PlaceSearchResult,
} from "../_shared/placeSearch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json; charset=utf-8",
};

// The scarce resource is global, not per user: reserve_place_search_upstream_slot
// serialises every cache miss at 1100 ms, so the whole project can serve roughly
// 54 upstream lookups per minute. A per-user ceiling above a fraction of that does
// not protect anything — one account could drain the shared budget and everybody
// else would see "Search is busy".
const USER_REQUESTS_PER_MINUTE = 12;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_UPSTREAM_RESPONSE_BYTES = 512 * 1024;

type QuotaRow = {
  allowed: boolean;
  retry_after_seconds: number;
};

type CacheRow = {
  results: unknown;
};

/**
 * Reads a response body as text but aborts as soon as it exceeds `maxBytes`.
 * Returns null when the ceiling is hit, so an oversized answer never has to be
 * held in memory in full.
 */
async function readBoundedText(
  response: Response,
  maxBytes: number,
): Promise<string | null> {
  const declaredLength = Number(response.headers.get("Content-Length") ?? "");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await response.body?.cancel();
    return null;
  }

  const reader = response.body?.getReader();
  if (!reader) return "";

  const decoder = new TextDecoder();
  let text = "";
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
  return text + decoder.decode();
}

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...jsonHeaders, ...extraHeaders },
  });
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("Authorization")?.trim() ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "GET") {
    return jsonResponse(
      { error: "Method not allowed." },
      405,
      { Allow: "GET, OPTIONS" },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabaseServiceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse({ error: "Server not configured." }, 500);
  }

  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  const parsed = parsePlaceSearchRequest(new URL(request.url));
  if (!parsed.ok) {
    return jsonResponse({ error: parsed.error }, 400);
  }

  try {
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const { data: userData, error: userError } =
      await userClient.auth.getUser(accessToken);
    if (userError || !userData.user) {
      return jsonResponse({ error: "Unauthorized." }, 401);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: quotaData, error: quotaError } = await adminClient.rpc(
      "consume_place_search_quota",
      {
        p_user_id: userData.user.id,
        p_limit: USER_REQUESTS_PER_MINUTE,
        p_window_seconds: 60,
      },
    );
    if (quotaError) {
      console.error("Place-search quota check failed:", quotaError.message);
      return jsonResponse({ error: "Search is temporarily unavailable." }, 503);
    }

    const quota = (quotaData as QuotaRow[] | null)?.[0];
    if (!quota?.allowed) {
      const retryAfter = Math.max(1, quota?.retry_after_seconds ?? 60);
      return jsonResponse(
        { error: "Too many searches. Please try again shortly." },
        429,
        { "Retry-After": String(retryAfter) },
      );
    }

    const cacheKey = await sha256Hex(buildPlaceSearchCacheInput(parsed.value));
    const nowIso = new Date().toISOString();
    const { data: cacheData, error: cacheError } = await adminClient
      .from("place_search_cache")
      .select("results")
      .eq("cache_key", cacheKey)
      .gt("expires_at", nowIso)
      .maybeSingle();

    if (cacheError) {
      console.error("Place-search cache read failed:", cacheError.message);
      return jsonResponse({ error: "Search is temporarily unavailable." }, 503);
    }

    const cachedResults = sanitizeNominatimResults(
      (cacheData as CacheRow | null)?.results,
      parsed.value.limit,
    );
    if (cachedResults) {
      // The cache is shared across all users and keyed only on the query text.
      // Reporting hit/miss would let any account probe whether somebody else
      // searched a given address in the last seven days, so the response never
      // reveals which path served it.
      return jsonResponse(cachedResults, 200, {
        "Cache-Control": "private, max-age=300",
      });
    }

    const { data: waitData, error: waitError } = await adminClient.rpc(
      "reserve_place_search_upstream_slot",
      {
        p_spacing_ms: 1100,
        p_max_wait_ms: 8000,
      },
    );
    if (waitError) {
      console.error("Place-search upstream reservation failed:", waitError.message);
      return jsonResponse({ error: "Search is temporarily unavailable." }, 503);
    }

    const waitMs = Number(waitData);
    if (!Number.isFinite(waitMs) || waitMs < 0) {
      return jsonResponse(
        { error: "Search is busy. Please try again shortly." },
        503,
        { "Retry-After": "2" },
      );
    }
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    const upstreamUrl = buildNominatimUrl(
      parsed.value,
      Deno.env.get("NOMINATIM_CONTACT_EMAIL"),
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(upstreamUrl, {
        headers: {
          Accept: "application/json",
          "Accept-Language": parsed.value.language,
          "User-Agent":
            Deno.env.get("NOMINATIM_USER_AGENT")?.trim() ||
            "Goals/1.0 (com.vibetime.app)",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!upstreamResponse.ok) {
      console.error(
        "Place-search upstream rejected request:",
        upstreamResponse.status,
      );
      return jsonResponse(
        { error: "Search provider is temporarily unavailable." },
        upstreamResponse.status === 429 ? 503 : 502,
        upstreamResponse.status === 429 ? { "Retry-After": "2" } : {},
      );
    }

    // Read with a hard byte ceiling instead of buffering first and measuring
    // afterwards: a chunked or Content-Length-less response would otherwise be
    // pulled into memory in full before the limit could ever reject it.
    const upstreamBody = await readBoundedText(
      upstreamResponse,
      MAX_UPSTREAM_RESPONSE_BYTES,
    );
    if (upstreamBody === null) {
      return jsonResponse({ error: "Search provider response was too large." }, 502);
    }

    let upstreamPayload: unknown;
    try {
      upstreamPayload = JSON.parse(upstreamBody);
    } catch {
      return jsonResponse({ error: "Search provider returned invalid data." }, 502);
    }
    const results: PlaceSearchResult[] | null = sanitizeNominatimResults(
      upstreamPayload,
      parsed.value.limit,
    );
    if (!results) {
      return jsonResponse({ error: "Search provider returned invalid data." }, 502);
    }

    const { error: cacheWriteError } = await adminClient
      .from("place_search_cache")
      .upsert(
        {
          cache_key: cacheKey,
          results,
          expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "cache_key" },
      );
    if (cacheWriteError) {
      // A cache outage must not discard a valid upstream response.
      console.error("Place-search cache write failed:", cacheWriteError.message);
    }

    // Deterministic low-frequency cleanup keeps expired cache rows bounded
    // without requiring pg_cron or adding work to every request.
    if (cacheKey.endsWith("00")) {
      const { error: cleanupError } = await adminClient
        .from("place_search_cache")
        .delete()
        .lt("expires_at", nowIso);
      if (cleanupError) {
        console.error("Place-search cache cleanup failed:", cleanupError.message);
      }
    }

    return jsonResponse(results, 200, {
      "Cache-Control": "private, max-age=300",
    });
  } catch (error) {
    const message = error instanceof Error ? error.name : "UnknownError";
    console.error("Place-search failed:", message);
    return jsonResponse(
      {
        error:
          message === "AbortError"
            ? "Search provider timed out."
            : "Search is temporarily unavailable.",
      },
      message === "AbortError" ? 504 : 500,
    );
  }
});
