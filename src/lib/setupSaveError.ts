/**
 * Why saving the setup failed, in words that help.
 *
 * Every failure used to read "Your setup could not be saved. Check your
 * connection and try again." — including the ones that have nothing to do with
 * a connection. A friend of Jannis' sat in that screen for days on an old build
 * whose sign-in upserted the profile row, which the database refuses (it grants
 * UPDATE on every column but `id`). The app answered "check your connection",
 * so he checked his connection, reinstalled, and checked again.
 *
 * A wrong reason is worse than no reason: it sends people to fix the one thing
 * that is not broken. So the cause is named, and where trying again cannot
 * possibly help, the screen stops offering it.
 */

export interface SetupSaveFailure {
  message: string;
  /** False when pressing the button again would only repeat the same failure. */
  canRetry: boolean;
}

/** Postgres/PostgREST codes that mean "allowed to ask, not allowed to do". */
const DENIED = new Set(["42501", "PGRST301", "PGRST116"]);

export function describeSetupSaveError(error: unknown): SetupSaveFailure {
  const entry = (error ?? {}) as { code?: string; message?: string; status?: number };
  const code = typeof entry.code === "string" ? entry.code : "";
  const status = typeof entry.status === "number" ? entry.status : 0;
  const text = typeof entry.message === "string" ? entry.message : "";

  // The profile row is gone. Signing in again rebuilds it; retrying never will.
  if (text.includes("account profile is missing")) {
    return {
      message: "Your account profile is missing. Sign out and sign in again — your data stays on the account.",
      canRetry: false,
    };
  }

  if (DENIED.has(code) || status === 401 || status === 403) {
    return {
      message:
        "Your account is not allowed to save this setup. That is a fault on our side, not yours — signing out and in again usually clears it. If it keeps happening, the app is out of date.",
      canRetry: false,
    };
  }

  // A rule the data broke: the same values will break it again.
  if (code.startsWith("23")) {
    return {
      message: `Something in this setup could not be stored${text ? ` (${text})` : ""}. Going back and choosing again usually fixes it.`,
      canRetry: false,
    };
  }

  return {
    message: "Your setup could not be saved. Check your connection and try again.",
    canRetry: true,
  };
}
