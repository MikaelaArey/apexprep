// Account: back up progress with Sign in with Apple, sign out, or delete the
// account (required by the App Store when accounts exist). Email-code sign-in is
// built but hidden: it needs a custom email sender in Supabase first
// (docs/SUPABASE.md), then EXPO_PUBLIC_EMAIL_SIGN_IN=1 turns it on.

import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, TextInput, View, useColorScheme } from 'react-native';
import { useStore } from '@/state/store';
import { appleSignInAvailable, deleteAccount, sendEmailCode, signInWithApple, signOut, useAccount, verifyEmailCode } from '@/sync/account';
import { syncNow } from '@/sync/sync';
import { Icon } from '@/ui/Icon';
import { Button, Card, Eyebrow, IconButton } from '@/ui/kit';
import { T } from '@/ui/Text';
import { radius, space, useColors } from '@/ui/theme';

const EMAIL_SIGN_IN = process.env.EXPO_PUBLIC_EMAIL_SIGN_IN === '1';

export default function Account() {
  const c = useColors();
  const scheme = useColorScheme();
  const account = useAccount();
  const lastSyncAt = useStore((s) => s.meta.lastSyncAt as number | undefined);
  const [apple, setApple] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    appleSignInAvailable().then(setApple);
  }, []);

  const run = async (label: string, task: () => Promise<{ ok: boolean; message?: string } | void>) => {
    setBusy(label);
    setMessage(null);
    try {
      const result = await task();
      if (result && !result.ok && result.message) setMessage(result.message);
    } finally {
      setBusy(null);
    }
  };

  const input = {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.borderStrong,
    paddingHorizontal: space.lg,
    fontSize: 17,
    color: c.text,
    backgroundColor: c.card,
  } as const;

  const signedIn = account.status === 'member';

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: c.bgGrouped }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.lg }}>
        <T variant="title">Account</T>
        <IconButton testID="account-close" icon="xmark" label="Close" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        {account.status === 'unavailable' ? (
          <Card style={{ gap: space.sm }}>
            <Icon name="icloud.slash" size={24} color={c.textMuted} />
            <T variant="headline">Backup isn’t set up in this build</T>
            <T variant="subhead" color="textMuted">
              Everything you do is saved on this iPhone. Accounts turn on once the app is connected to its server.
            </T>
          </Card>
        ) : signedIn ? (
          <Card style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Icon name="checkmark.icloud.fill" size={28} color={c.primary} />
              <View style={{ flex: 1 }}>
                <T variant="headline">Your progress is backed up</T>
                <T variant="subhead" color="textMuted">
                  {account.email ?? (account.provider === 'apple' ? 'Signed in with Apple' : 'Signed in')}
                </T>
              </View>
            </View>
            <T variant="footnote" color="textMuted">
              Last backup: {lastSyncAt ? new Date(lastSyncAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'not yet'}
            </T>
            <Button kind="secondary" size="md" title="Back up now" icon="arrow.clockwise" loading={busy === 'sync'} onPress={() => run('sync', async () => {
              const r = await syncNow();
              if (!r.ok) return { ok: false, message: r.message ?? 'Couldn’t reach the server. It will retry automatically.' };
            })} />
          </Card>
        ) : (
          <>
            <View style={{ gap: space.sm }}>
              <T variant="largeTitle" style={{ fontSize: 28, lineHeight: 34 }}>
                Keep your progress safe
              </T>
              <T variant="subhead" color="textMuted">
                {account.status === 'guest'
                  ? 'You’re studying as a guest. Your progress backs up, but only this iPhone can get it back. Sign in to keep it if you switch phones.'
                  : 'Sign in to back up your streak, reviews and stats, and pick up on any iPhone.'}
              </T>
            </View>
            {apple ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={scheme === 'dark' ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={radius.md}
                style={{ height: 54 }}
                onPress={() => run('apple', signInWithApple)}
              />
            ) : (
              <T variant="footnote" color="textMuted" testID="apple-unavailable">
                Sign in with Apple isn’t available on this device.
              </T>
            )}
            {EMAIL_SIGN_IN ? (
              <Card style={{ gap: space.md }}>
                <Eyebrow>Or use an email code</Eyebrow>
                <TextInput
                  testID="email-input"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@school.edu"
                  placeholderTextColor={c.textFaint}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  style={input}
                />
                {sent ? (
                  <TextInput
                    testID="code-input"
                    value={code}
                    onChangeText={setCode}
                    placeholder="6-digit code"
                    placeholderTextColor={c.textFaint}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    maxLength={8}
                    style={input}
                  />
                ) : null}
                {sent ? (
                  <Button title="Sign in" loading={busy === 'verify'} disabled={code.trim().length < 6} onPress={() => run('verify', () => verifyEmailCode(email, code))} />
                ) : (
                  <Button
                    kind="secondary"
                    title="Email me a code"
                    loading={busy === 'send'}
                    disabled={!/^\S+@\S+\.\S+$/.test(email.trim())}
                    onPress={() =>
                      run('send', async () => {
                        const r = await sendEmailCode(email);
                        if (r.ok) setSent(true);
                        return r;
                      })
                    }
                  />
                )}
              </Card>
            ) : null}
          </>
        )}

        {message ? (
          <T variant="subhead" color="danger" testID="account-error">
            {message}
          </T>
        ) : null}

        {account.status === 'member' || account.status === 'guest' ? (
          <View style={{ gap: space.md, marginTop: space.lg }}>
            {signedIn ? (
              <Button
                kind="secondary"
                title="Sign out"
                onPress={() =>
                  Alert.alert('Sign out?', 'Your progress stays in your account. This iPhone will start fresh.', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Sign out',
                      style: 'destructive',
                      onPress: () =>
                        run('signout', async () => {
                          if (router.canDismiss()) router.dismissAll();
                          await signOut();
                        }),
                    },
                  ])
                }
              />
            ) : null}
            <Button
              testID="delete-account"
              kind="danger"
              title="Delete account and data"
              onPress={() =>
                Alert.alert('Delete your account?', 'This permanently deletes your account and all of your progress, on this iPhone and on our server. It can’t be undone.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () =>
                      run('delete', async () => {
                        const result = await deleteAccount();
                        if (result.ok && router.canDismiss()) router.dismissAll();
                        return result;
                      }),
                  },
                ])
              }
            />
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
