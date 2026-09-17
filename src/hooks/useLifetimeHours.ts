import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { totalTrackedHours } from "../lib/rewards";

const PAGE_SIZE = 1000;

/**
 * All-time tracked hours, Focus Timer and Auto Check-In together.
 *
 * The key sits under ["sessions"], so every place that invalidates sessions after
 * a session ends also refreshes this total. PostgREST caps one response at 1,000
 * rows, hence the paging.
 */
export function useLifetimeHours() {
  return useQuery({
    queryKey: ["sessions", "lifetime-hours"],
    queryFn: async (): Promise<number> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return 0;

      const rows: Array<{ duration_seconds: number | null; end_time: string | null }> = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabase
          .from("sessions")
          .select("duration_seconds, end_time")
          .eq("user_id", user.id)
          .not("end_time", "is", null)
          .order("start_time", { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        const page = (data ?? []) as typeof rows;
        rows.push(...page);
        if (page.length < PAGE_SIZE) break;
      }
      return totalTrackedHours(rows);
    },
  });
}
