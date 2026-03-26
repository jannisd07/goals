import { useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAppStore } from "../store";
import type { UserConfig } from "../types";

export function useAuth() {
  const setAuthenticated = useAppStore((s) => s.setAuthenticated);
  const setUserConfig = useAppStore((s) => s.setUserConfig);
  const setLoading = useAppStore((s) => s.setLoading);
  const setFixedCommitments = useAppStore((s) => s.setFixedCommitments);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setAuthenticated(true);
          await loadUserConfig(session.user.id);
        } else {
          setAuthenticated(false);
        }
      } catch {
        setAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          setAuthenticated(true);
          await loadUserConfig(session.user.id);
        } else {
          setAuthenticated(false);
          setUserConfig(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [setAuthenticated, setUserConfig, setLoading, setFixedCommitments]);

  const loadUserConfig = async (userId: string) => {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (!error && data) {
      const config = data as UserConfig;
      setUserConfig(config);
      if (config.fixed_commitments) {
        setFixedCommitments(config.fixed_commitments);
      }
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    if (data.user) {
      const { error: insertError } = await supabase.from("users").insert({
        id: data.user.id,
        display_name: displayName,
        fixed_commitments: {
          sleep_hours_per_night: 8,
          work_hours_per_day: 8,
          work_days_per_week: 5,
          daily_overhead_hours: 2,
        },
        onboarding_complete: false,
      });
      if (insertError) throw insertError;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setAuthenticated(false);
    setUserConfig(null);
  };

  return { signInWithEmail, signUpWithEmail, signOut };
}
