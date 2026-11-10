import type { EmailOtpType } from '@supabase/supabase-js';

import { supabase } from './supabase';

/**
 * Stable app deep link. Expo Go's Linking.createURL() is exp://LAN-IP:8081,
 * which changes and is not on the hosted Auth allow list, so emails fall back
 * to Site URL (localhost:3000). listy:// is declared in app.json and works in
 * Expo Go when this project is open.
 */
export function getAuthRedirectUrl(): string {
  return 'listy://auth/callback';
}

const OTP_TYPES: EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'];

function paramsFromUrl(url: string): URLSearchParams {
  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1).split('#')[0] : '';
  return new URLSearchParams(`${query}&${hash}`);
}

function otpTypeFromUrl(raw: string | null): EmailOtpType {
  if (raw && OTP_TYPES.includes(raw as EmailOtpType)) return raw as EmailOtpType;
  return 'email';
}

/** Complete sign-in when a confirmation email (or magic link) opens the app. */
export async function createSessionFromUrl(url: string): Promise<void> {
  const params = paramsFromUrl(url);
  const error = params.get('error_description') ?? params.get('error');
  if (error) throw new Error(error);

  const token_hash = params.get('token_hash');
  if (token_hash) {
    const { error: otpError } = await supabase.auth.verifyOtp({
      token_hash,
      type: otpTypeFromUrl(params.get('type')),
    });
    if (otpError) throw otpError;
    return;
  }

  const code = params.get('code');
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
    return;
  }

  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) {
    const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
    if (sessionError) throw sessionError;
  }
}

export function urlLooksLikeAuthCallback(url: string | null): url is string {
  if (!url) return false;
  return ['access_token', 'refresh_token', 'code=', 'token_hash'].some((part) => url.includes(part));
}
