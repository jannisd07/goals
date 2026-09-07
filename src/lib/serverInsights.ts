export type ServerInsightStatus = "ready" | "insufficient_data";

export interface ServerInsight {
  insight: string;
  status: ServerInsightStatus;
  generated_at: string;
  refreshes_remaining: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseServerInsight(value: unknown): ServerInsight {
  if (!isRecord(value)) {
    throw new Error("The insight response was empty.");
  }

  const insight = typeof value.insight === "string" ? value.insight.trim() : "";
  const status = value.status;
  const generatedAt = value.generated_at;
  const remaining = value.refreshes_remaining;

  if (
    insight.length === 0 ||
    insight.length > 2000 ||
    (status !== "ready" && status !== "insufficient_data") ||
    typeof generatedAt !== "string" ||
    !Number.isFinite(Date.parse(generatedAt)) ||
    (remaining !== null &&
      (!Number.isInteger(remaining) ||
        (remaining as number) < 0 ||
        (remaining as number) > 3))
  ) {
    throw new Error("The insight response was invalid.");
  }

  return {
    insight,
    status,
    generated_at: generatedAt,
    refreshes_remaining: remaining as number | null,
  };
}

export function formatInsightUpdatedAt(iso: string, now = new Date()): string {
  const updated = new Date(iso);
  if (!Number.isFinite(updated.getTime())) return "";

  if (
    updated.getFullYear() === now.getFullYear() &&
    updated.getMonth() === now.getMonth() &&
    updated.getDate() === now.getDate()
  ) {
    return `Updated today at ${updated.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }

  return `Updated ${updated.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}
