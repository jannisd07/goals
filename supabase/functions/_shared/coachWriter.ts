/**
 * Turns already-verified patterns into notification copy.
 *
 * The model never sees raw sessions and never decides *whether* to nudge — it
 * only phrases numbers that `coachPatterns.ts` already computed. Only stable
 * patterns are sent: counters that change daily (weekly progress, days since
 * the last session) always use the deterministic wording, so cached copy never
 * shows yesterday's numbers. Model copy that adds a number or turns a
 * comparison into a change over time ("up from 21 minutes") is discarded.
 * One request writes every nudge for a user at once, and any failure falls back
 * to the deterministic wording, so the feature works with the AI switched off.
 */

export type NudgeTiming = "weekly" | "once";

/**
 * Structurally compatible with `CoachPattern` in `coachPatterns.ts`, declared
 * locally so this file stays import-free and can be compiled by both Deno and
 * the Node-based domain test suite.
 */
export interface WritablePattern {
  kind: string;
  goalId: string;
  weekday: number | null;
  hour: number | null;
  timing: NudgeTiming;
  expiresAt: string | null;
  confidence: number;
  /** Numbers change daily; always worded deterministically. */
  volatile: boolean;
  facts: Record<string, string | number>;
  fallbackTitle: string;
  fallbackBody: string;
}

export const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";

export const MAX_TITLE_CHARS = 48;
export const MAX_BODY_CHARS = 150;

export interface CoachNudge {
  kind: string;
  goalId: string;
  /** 0 = Sunday … 6 = Saturday, or null for "as soon as sensible". */
  weekday: number | null;
  hour: number | null;
  /** "weekly" repeats on `weekday`; "once" fires a single time. */
  timing: NudgeTiming;
  /** After this instant the advice is outdated and must not fire. */
  expiresAt: string | null;
  title: string;
  body: string;
  confidence: number;
  /** True when the wording came from the model rather than the fallback. */
  written: boolean;
}

const SYSTEM_PROMPT = [
  "You write short push notifications for a focus and habit app.",
  "You are given observations that were already computed from the user's own history.",
  "For each observation write one notification.",
  "Rules:",
  `- title: at most ${MAX_TITLE_CHARS} characters, no trailing period.`,
  "- The title must be a statement the user can act on, never a label.",
  '  Good: "Tuesdays at 2pm are your best". Bad: "Gym rating trend".',
  `- body: at most ${MAX_BODY_CHARS} characters, one or two short sentences.`,
  "- Use ONLY the numbers and names given. Never invent a statistic, a day or a time, and never convert units.",
  "- A comparison between groups (for example Tuesdays against other days) is not a change over time.",
  '  Only an observation of type "trend" may say that something went up, improved or changed recently.',
  "- Write in English, second person, warm but factual. No hype, no emoji, no exclamation marks.",
  "- Mention the concrete number that makes the observation credible.",
  "- End with a small, doable suggestion when the observation supports one.",
  "- Never imply the user failed or should feel guilty.",
  'Reply with JSON only: {"nudges":[{"id":"<id>","title":"...","body":"..."}]}',
].join("\n");

/** Wording that claims a change over time. Only trend observations may use it. */
const CHANGE_OVER_TIME =
  /\b(up from|down from|increas\w*|decreas\w*|improv\w*|grow\w*|grew|rise|rises|rising|rose|drop\w*|fell|falling|lately|recently|than before|anymore)\b/i;

function clampText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  // Cut on a word boundary so the text never ends mid-word.
  const cut = cleaned.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}

function numbersIn(text: string): string[] {
  return (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => String(Number(n.replace(",", "."))));
}

/**
 * True when model copy only uses numbers the pattern already contains and does
 * not describe a comparison as a trend.
 */
export function isFaithfulCopy(pattern: WritablePattern, title: string, body: string): boolean {
  const text = `${title} ${body}`;
  const source = [
    ...Object.values(pattern.facts).map(String),
    pattern.fallbackTitle,
    pattern.fallbackBody,
  ].join(" ");
  const allowed = new Set(numbersIn(source));
  if (numbersIn(text).some((n) => !allowed.has(n))) return false;
  if (pattern.kind !== "trend" && CHANGE_OVER_TIME.test(text)) return false;
  return true;
}

/** Stable identity of one piece of advice, used to reuse cached copy. */
export function patternKey(pattern: {
  kind: string;
  goalId: string;
  weekday: number | null;
  hour: number | null;
}): string {
  return `${pattern.kind}:${pattern.goalId}:${pattern.weekday ?? "-"}:${pattern.hour ?? "-"}`;
}

/** Whether any pattern is worth a model call at all. */
export function hasWritablePatterns(patterns: WritablePattern[]): boolean {
  return patterns.some((p) => !p.volatile);
}

/**
 * Compact prompt payload: numbers only, no session rows, no user identifiers.
 * Ids are positions in the full list, so the answer merges back by index.
 */
export function buildWriterPayload(patterns: WritablePattern[]): string {
  return JSON.stringify({
    observations: patterns
      .map((pattern, index) => ({ pattern, index }))
      .filter(({ pattern }) => !pattern.volatile)
      .map(({ pattern, index }) => ({
        id: `n${index}`,
        type: pattern.kind,
        ...pattern.facts,
      })),
  });
}

function toNudge(
  pattern: WritablePattern,
  title: string,
  body: string,
  written: boolean,
): CoachNudge {
  return {
    kind: pattern.kind,
    goalId: pattern.goalId,
    weekday: pattern.weekday,
    hour: pattern.hour,
    timing: pattern.timing,
    expiresAt: pattern.expiresAt,
    title,
    body,
    confidence: pattern.confidence,
    written,
  };
}

function fallbackNudge(pattern: WritablePattern): CoachNudge {
  return toNudge(
    pattern,
    clampText(pattern.fallbackTitle, MAX_TITLE_CHARS),
    clampText(pattern.fallbackBody, MAX_BODY_CHARS),
    false,
  );
}

export function fallbackNudges(patterns: WritablePattern[]): CoachNudge[] {
  return patterns.map(fallbackNudge);
}

/**
 * Merges model output onto the patterns. Anything missing, empty, unfaithful or
 * volatile keeps its deterministic wording, so a partial answer still produces
 * a full set.
 */
export function mergeWriterResponse(
  patterns: WritablePattern[],
  content: string,
): CoachNudge[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return fallbackNudges(patterns);
  }
  const list = (parsed as { nudges?: unknown })?.nudges;
  if (!Array.isArray(list)) return fallbackNudges(patterns);

  const byId = new Map<string, { title: string; body: string }>();
  for (const entry of list) {
    if (entry === null || typeof entry !== "object") continue;
    const id = (entry as { id?: unknown }).id;
    if (typeof id !== "string") continue;
    byId.set(id, {
      title: clampText((entry as { title?: unknown }).title, MAX_TITLE_CHARS),
      body: clampText((entry as { body?: unknown }).body, MAX_BODY_CHARS),
    });
  }

  return patterns.map((pattern, index) => {
    if (pattern.volatile) return fallbackNudge(pattern);
    const written = byId.get(`n${index}`);
    if (
      !written ||
      written.title.length < 3 ||
      written.body.length < 10 ||
      !isFaithfulCopy(pattern, written.title, written.body)
    ) {
      return fallbackNudge(pattern);
    }
    return toNudge(pattern, written.title, written.body, true);
  });
}

/**
 * Rebuilds the nudge list from cached copy: stable patterns keep their cached
 * wording, volatile ones are always worded fresh from today's numbers.
 */
export function reuseCachedNudges(
  patterns: WritablePattern[],
  cached: CoachNudge[],
): CoachNudge[] {
  const byKey = new Map(cached.map((nudge) => [patternKey(nudge), nudge]));
  return patterns.map((pattern) => {
    const hit = pattern.volatile ? undefined : byKey.get(patternKey(pattern));
    if (!hit || typeof hit.title !== "string" || typeof hit.body !== "string") {
      return fallbackNudge(pattern);
    }
    return toNudge(pattern, hit.title, hit.body, hit.written === true);
  });
}

export interface WriteResult {
  nudges: CoachNudge[];
  /** False when the deterministic wording was used, i.e. no tokens were spent. */
  usedModel: boolean;
  error: string | null;
}

/** Single Groq request for the whole set. Never throws. */
export async function writeNudges(
  patterns: WritablePattern[],
  apiKey: string | null,
  model: string = DEFAULT_GROQ_MODEL,
  fetchImpl: typeof fetch = fetch,
): Promise<WriteResult> {
  if (patterns.length === 0) {
    return { nudges: [], usedModel: false, error: null };
  }
  if (!apiKey || !hasWritablePatterns(patterns)) {
    return { nudges: fallbackNudges(patterns), usedModel: false, error: null };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const response = await fetchImpl(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_completion_tokens: 700,
        // Keeps output small and predictable; reasoning tokens are billable noise here.
        reasoning_effort: "low",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildWriterPayload(patterns) },
        ],
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        nudges: fallbackNudges(patterns),
        usedModel: false,
        error: `groq_${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
      };
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      return { nudges: fallbackNudges(patterns), usedModel: false, error: "empty_completion" };
    }

    const merged = mergeWriterResponse(patterns, content);
    return {
      nudges: merged,
      usedModel: merged.some((n) => n.written),
      error: null,
    };
  } catch (error) {
    return {
      nudges: fallbackNudges(patterns),
      usedModel: false,
      error: error instanceof Error ? error.message : "groq_request_failed",
    };
  }
}
