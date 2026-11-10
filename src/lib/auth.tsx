import type { EmailOtpType, Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { createSessionFromUrl, getAuthRedirectUrl, urlLooksLikeAuthCallback } from './auth-redirect';
import { supabase } from './supabase';

type AuthContextValue = {
  session: Session | null;
  /** True until the persisted session has been read from storage. */
  loading: boolean;
  /** True after tapping a "reset password" email link. */
  passwordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  /** Returns true when the user must enter the email confirmation code. */
  signUp: (email: string, password: string, displayName?: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<void>;
  verifyEmailOtp: (email: string, token: string, type: EmailOtpType) => Promise<void>;
  resendEmailOtp: (email: string, type: 'signup' | 'recovery') => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Keep this callback synchronous - awaiting supabase calls in here can deadlock.
    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      if (event === 'SIGNED_OUT') setPasswordRecovery(false);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function handleUrl(url: string | null) {
      if (!urlLooksLikeAuthCallback(url)) return;
      if (url.includes('type=recovery')) setPasswordRecovery(true);
      createSessionFromUrl(url).catch((e) => {
        console.warn('Could not complete sign-in from email link', e);
      });
    }

    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      passwordRecovery,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      },
      signUp: async (email, password, displayName) => {
        const redirectTo = getAuthRedirectUrl();
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: redirectTo,
            data: displayName ? { display_name: displayName.trim() } : undefined,
          },
        });
        if (error) throw error;
        // Existing account: Supabase returns 200 with an empty identities list and no session.
        if (data.user && (data.user.identities?.length ?? 0) === 0) {
          throw new Error('An account with this email already exists. Sign in, or reset your password.');
        }
        return !data.session;
      },
      resetPassword: async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: getAuthRedirectUrl(),
        });
        if (error) throw error;
      },
      verifyEmailOtp: async (email, token, type) => {
        const trimmed = { email: email.trim(), token: token.trim() };
        let { error } = await supabase.auth.verifyOtp({ ...trimmed, type });
        if (error && type === 'signup') {
          ({ error } = await supabase.auth.verifyOtp({ ...trimmed, type: 'email' }));
        }
        if (error) throw error;
        if (type === 'recovery') setPasswordRecovery(true);
      },
      resendEmailOtp: async (email, type) => {
        const trimmed = email.trim();
        if (type === 'recovery') {
          const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
            redirectTo: getAuthRedirectUrl(),
          });
          if (error) throw error;
          return;
        }
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email: trimmed,
          options: { emailRedirectTo: getAuthRedirectUrl() },
        });
        if (error) throw error;
      },
      updatePassword: async (password) => {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setPasswordRecovery(false);
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    }),
    [session, loading, passwordRecovery],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
