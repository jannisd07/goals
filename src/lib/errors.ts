/**
 * The message a person gets to see when something fails.
 *
 * Errors the app throws for the player are written as plain `Error`s with a
 * sentence in them, and those pass straight through. Errors from PostgREST,
 * GoTrue and the Edge Functions describe the database or the transport
 * ("JSON object requested, multiple (or no) rows returned", "Edge Function
 * returned a non-2xx status code") and are replaced by the caller's fallback.
 */
export function userFacingMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  // PostgREST and GoTrue errors carry a code; Supabase function errors have
  // their own class names. Neither is written for the person holding the phone.
  if ("code" in error && typeof (error as { code?: unknown }).code === "string") return fallback;
  if (error.name.startsWith("Functions")) return fallback;

  const message = error.message.trim();
  if (!message) return fallback;
  if (/network request failed|failed to fetch|timed? ?out/i.test(message)) {
    return "Check your connection and try again.";
  }
  return message;
}
