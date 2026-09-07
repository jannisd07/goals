import { useEffect } from "react";
import { useAppStore } from "../store";
import {
  getGeofencePermissionWarning,
  getNotificationPermissionWarning,
  registerGeofences,
} from "../services/geofencing";

export function useRefreshPermissionWarnings(refreshTrigger: number): void {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const goals = useAppStore((s) => s.goals);
  const setAutoCheckInPermissionWarning = useAppStore((s) => s.setAutoCheckInPermissionWarning);
  const setNotificationPermissionWarning = useAppStore((s) => s.setNotificationPermissionWarning);

  useEffect(() => {
    if (!isAuthenticated) {
      setAutoCheckInPermissionWarning(null);
      setNotificationPermissionWarning(null);
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const [notificationWarning, geofenceWarning] = await Promise.all([
          getNotificationPermissionWarning(),
          getGeofencePermissionWarning(goals),
        ]);

        if (cancelled) return;

        setNotificationPermissionWarning(notificationWarning);
        setAutoCheckInPermissionWarning(geofenceWarning);

        // If permissions are back, ensure geofences are actively registered.
        if (!geofenceWarning) {
          const result = await registerGeofences(goals);
          if (cancelled) return;
          setAutoCheckInPermissionWarning(result.warningMessage);
        }
      } catch {
        // Keep existing warnings as-is if refresh check fails unexpectedly.
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    refreshTrigger,
    isAuthenticated,
    goals,
    setAutoCheckInPermissionWarning,
    setNotificationPermissionWarning,
  ]);
}
