/**
 * Device-local keys owned by the Goals app.
 *
 * The iOS app intentionally keeps the historical `com.vibetime.app` bundle
 * identifier. A versioned namespace prevents persisted state from the former
 * Max app (or an incompatible beta) from being hydrated into the Goals store.
 */
export const APP_STORE_STORAGE_KEY = "goals-app-state-v3";
export const AUTH_STORAGE_KEY = "goals-auth-session-v1";
