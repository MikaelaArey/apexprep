// Accounts. Everyone starts as an anonymous guest (progress still backs up);
// signing in with Apple upgrades the guest account in place, so nothing is lost.
// Email codes sign in to an existing or new account and upload this device's
// progress to it; the app only offers them when EXPO_PUBLIC_EMAIL_SIGN_IN=1.

import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/state/store';
import { syncNow } from './sync';

export type Account =
  | { status: 'unavailable' }
  | { status: 'none' }
  | { status: 'guest'; userId: string }
  | { status: 'member'; userId: string; email: string | null; provider: string };

function describe(session: Awaited<ReturnType<NonNullable<typeof supabase>['auth']['getSession']>>['data']['session']): Account {
  if (!supabase) return { status: 'unavailable' };
  if (!session) return { status: 'none' };
  const u = session.user;
  if (u.is_anonymous) return { status: 'guest', userId: u.id };
  const provider = u.app_metadata?.provider ?? u.identities?.[0]?.provider ?? 'email';
  return { status: 'member', userId: u.id, email: u.email ?? null, provider };
}

export function useAccount(): Account {
  const [account, setAccount] = useState<Account>(supabase ? { status: 'none' } : { status: 'unavailable' });
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setAccount(describe(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setAccount(describe(session)));
    return () => data.subscription.unsubscribe();
  }, []);
  return account;
}

/** Network failures surface as "fetch failed…"; tell the student what to do instead. */
function friendly(message: string): string {
  return /fetch failed|network request failed|offline|timed out|aborted/i.test(message) ? 'You’re offline. Connect to the internet and try again.' : message;
}

export async function appleSignInAvailable(): Promise<boolean> {
  return AppleAuthentication.isAvailableAsync().catch(() => false);
}

export async function signInWithApple(): Promise<{ ok: boolean; message?: string }> {
  if (!supabase) return { ok: false, message: 'Sync isn’t set up in this build.' };
  let token: string | null = null;
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    token = credential.identityToken;
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return { ok: false };
    return { ok: false, message: friendly((e as Error).message) };
  }
  if (!token) return { ok: false, message: 'Apple didn’t return a sign-in token.' };

  const { data } = await supabase.auth.getSession();
  if (data.session?.user.is_anonymous) {
    // Upgrade the guest account in place. If this Apple ID already has an
    // account, sign in to that one instead; sync then uploads this device's work.
    const linked = await supabase.auth.linkIdentity({ provider: 'apple', token });
    if (!linked.error) {
      await syncNow();
      return { ok: true };
    }
  }
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token });
  if (error) return { ok: false, message: friendly(error.message) };
  await syncNow();
  return { ok: true };
}

export async function sendEmailCode(email: string): Promise<{ ok: boolean; message?: string }> {
  if (!supabase) return { ok: false, message: 'Sync isn’t set up in this build.' };
  const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
  return error ? { ok: false, message: friendly(error.message) } : { ok: true };
}

export async function verifyEmailCode(email: string, code: string): Promise<{ ok: boolean; message?: string }> {
  if (!supabase) return { ok: false, message: 'Sync isn’t set up in this build.' };
  const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
  if (error) return { ok: false, message: friendly(error.message) };
  await syncNow();
  return { ok: true };
}

/** Signs out and clears this device. Progress stays in the account. */
export async function signOut(): Promise<void> {
  await syncNow().catch(() => undefined);
  await supabase?.auth.signOut();
  await useStore.getState().resetProgress();
}

/** Permanently deletes the account and everything stored with it (App Store requirement). */
export async function deleteAccount(): Promise<{ ok: boolean; message?: string }> {
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const { error } = await supabase.rpc('delete_my_account');
      if (error) return { ok: false, message: friendly(error.message) };
      await supabase.auth.signOut();
    }
  }
  await useStore.getState().resetProgress();
  return { ok: true };
}

/** How other students answered a question; only shown once enough people have. */
export async function fetchAnswerCounts(itemId: string): Promise<Record<string, number> | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('item_answer_counts', { p_item_id: itemId });
  if (error || !data) return null;
  const counts: Record<string, number> = {};
  for (const row of data as { selected: string; n: number }[]) counts[row.selected] = Number(row.n);
  return counts;
}
