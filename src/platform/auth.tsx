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
  /** true quando o usuário chegou por um link de redefinição de senha */
  recovery: boolean;
  /** Candidatos: login sem senha por link mágico. */
  signIn: (email: string) => Promise<{ error?: string }>;
  /** Comissão: login com e-mail + senha (não depende de e-mail para entrar). */
  signInWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
  /** Envia o link de redefinição de senha (abre no MESMO navegador). */
  resetPassword: (email: string) => Promise<{ error?: string }>;
  /** Define/troca a senha do usuário logado (ou em recuperação). */
  updatePassword: (password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

/** Traduz os erros mais comuns do Supabase Auth para PT-BR. */
function ptError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("rate limit")) return "Muitas tentativas — aguarde alguns minutos e tente novamente.";
  if (m.includes("password should be") || m.includes("password is too weak"))
    return "A senha não atende aos requisitos mínimos (10+ caracteres).";
  if (m.includes("same password")) return "A nova senha precisa ser diferente da atual.";
  if (m.includes("email not confirmed")) return "E-mail ainda não confirmado — verifique sua caixa de entrada.";
  return message;
}

/**
 * Sessão + perfil (papel) do usuário. Dois modos de entrada:
 * candidatos usam link mágico; a comissão usa e-mail + senha.
 */
export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(platformEnabled);
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (!platformEnabled) return;
    const sb = supabase();

    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });

    const { data: sub } = sb.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
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
    if (error) return { error: ptError(error.message) };
    setOtpSentTo(clean);
    return {};
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const clean = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return { error: "Informe um e-mail válido." };
    if (!password) return { error: "Informe a senha." };
    const { error } = await supabase().auth.signInWithPassword({ email: clean, password });
    if (error) return { error: ptError(error.message) };
    return {};
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const clean = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return { error: "Informe um e-mail válido." };
    const { error } = await supabase().auth.resetPasswordForEmail(clean, {
      redirectTo: window.location.href,
    });
    if (error) return { error: ptError(error.message) };
    return {};
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase().auth.updateUser({ password });
    if (error) return { error: ptError(error.message) };
    setRecovery(false);
    return {};
  }, []);

  const signOut = useCallback(async () => {
    await supabase().auth.signOut();
    setProfile(null);
    setOtpSentTo(null);
    setRecovery(false);
  }, []);

  return {
    session,
    profile,
    loading,
    otpSentTo,
    recovery,
    signIn,
    signInWithPassword,
    resetPassword,
    updatePassword,
    signOut,
  };
}
