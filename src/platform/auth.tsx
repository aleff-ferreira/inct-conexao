import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { platformEnabled, supabase } from "./supabaseClient";
import type { Profile } from "./types";

export type AuthState = {
  /** null enquanto carrega; depois a sessão (ou ausência dela) */
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  /** e-mail para onde o link mágico foi enviado (feedback de UI) */
  otpSentTo: string | null;
  signIn: (email: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

/**
 * Sessão + perfil (papel) do usuário. Login sem senha por link mágico:
 * o candidato/avaliador digita o e-mail, recebe o link e volta autenticado.
 */
export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(platformEnabled);
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (!platformEnabled) return;
    const sb = supabase();

    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });

    const { data: sub } = sb.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!platformEnabled || !session) return;
    let cancelled = false;
    supabase()
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => {
        if (!cancelled) {
          setProfile((data as Profile) ?? null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const signIn = useCallback(async (email: string) => {
    const clean = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return { error: "Informe um e-mail válido." };
    const { error } = await supabase().auth.signInWithOtp({
      email: clean,
      options: { emailRedirectTo: window.location.href },
    });
    if (error) return { error: error.message };
    setOtpSentTo(clean);
    return {};
  }, []);

  const signOut = useCallback(async () => {
    await supabase().auth.signOut();
    setProfile(null);
    setOtpSentTo(null);
  }, []);

  return { session, profile, loading, otpSentTo, signIn, signOut };
}
