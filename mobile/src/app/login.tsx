import * as Linking from 'expo-linking';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { ActivityIndicator } from 'react-native';

import { Body, Button, ErrorText, Field, Muted, Title } from '@/components/ui';
import { humanError } from '@/lib/format';
import { hasDevAutoSignIn, useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { space, useTheme } from '@/lib/theme';

/**
 * Two ways in, because Supabase's own email has real limits: templates cannot
 * be edited without configuring custom SMTP, and the built-in sender is rate
 * limited to a handful of messages an hour.
 *
 * Password is the default for that reason. It costs no email at all, works
 * identically in Expo Go, a store build and the browser, and needs no deep link
 * coming back. Nothing is lost by it either -- the only Supabase email this app
 * ever sends is a broker signing themselves in. Clients receive their tour link
 * from the broker's own text or email, never from Supabase.
 */
type Mode = 'password' | 'email-sent';

export default function LoginScreen() {
  const { isBroker, loading: sessionLoading, autoSignInError } = useSession();
  const t = useTheme();

  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isBroker) return <Redirect href="/tours" />;

  // .env is set up to sign in for us, and it has not failed yet -- so show
  // that rather than a form the developer is about to be taken away from.
  if (hasDevAutoSignIn() && sessionLoading && !autoSignInError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
        <ActivityIndicator color={t.primary} />
        <Muted>Signing you in…</Muted>
      </View>
    );
  }

  function describe(message: string): string {
    if (/invalid login credentials/i.test(message)) {
      return 'That email and password do not match an account. You can set or change the password in Supabase under Authentication → Users.';
    }
    if (/signups not allowed|user not found/i.test(message)) {
      return 'That email is not set up as a broker on this app. Add the account in Supabase under Authentication → Users.';
    }
    if (/email not confirmed/i.test(message)) {
      return 'That account has not been confirmed. In Supabase under Authentication → Users, edit the user and confirm their email.';
    }
    return humanError(message);
  }

  async function signInWithPassword() {
    setError(null);
    setBusy(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(describe(signInError.message));
      setBusy(false);
    }
    // On success the session listener redirects; leave the spinner running.
  }

  async function sendEmailLink() {
    if (!email.trim()) {
      setError('Enter your email first.');
      return;
    }
    setError(null);
    setBusy(true);

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: Linking.createURL('/'),
        // Broker accounts are added deliberately in the dashboard. Enforced
        // here rather than by disabling signups project-wide, because that
        // switch would also block the anonymous sessions guests depend on.
        shouldCreateUser: false,
      },
    });

    setBusy(false);
    if (otpError) {
      setError(describe(otpError.message));
      return;
    }
    setMode('email-sent');
  }

  async function verifyCode() {
    const token = code.replace(/\D/g, '');
    if (token.length < 6) return;

    setError(null);
    setBusy(true);

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: 'email',
    });

    if (verifyError) {
      setError(
        /expired|invalid/i.test(verifyError.message)
          ? 'That code is wrong or has expired. Send a new one and try again.'
          : humanError(verifyError.message),
      );
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ padding: space.xl, gap: space.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <Title>Broker sign-in</Title>

        {autoSignInError ? <ErrorText>{autoSignInError}</ErrorText> : null}
        <Body style={{ color: t.textMuted }}>
          Clients don&apos;t need an account — they just open the tour link you send them.
        </Body>

        <Field
          label="Work email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@cresa.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          inputMode="email"
          editable={mode === 'password'}
        />

        {mode === 'password' ? (
          <>
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={signInWithPassword}
            />

            <ErrorText>{error}</ErrorText>

            <Button
              title="Sign in"
              onPress={signInWithPassword}
              busy={busy}
              disabled={!email.trim() || !password}
            />

            <Pressable onPress={sendEmailLink} hitSlop={10} accessibilityRole="button">
              <Muted style={{ textAlign: 'center', textDecorationLine: 'underline' }}>
                Email me a sign-in link instead
              </Muted>
            </Pressable>
          </>
        ) : (
          <>
            <View
              style={{
                backgroundColor: t.surface,
                borderRadius: 10,
                padding: space.lg,
                gap: space.xs,
              }}
            >
              <Body style={{ fontWeight: '600' }}>Check your email.</Body>
              <Muted>
                Sent to {email.trim()}. Tap the link in it — or if the email includes a
                6-digit code, type that below.
              </Muted>
            </View>

            <Field
              label="6-digit code"
              value={code}
              onChangeText={setCode}
              placeholder="123456"
              keyboardType="number-pad"
              inputMode="numeric"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={6}
              returnKeyType="go"
              onSubmitEditing={verifyCode}
              style={{ fontSize: 24, letterSpacing: 6 }}
            />

            <ErrorText>{error}</ErrorText>

            <Button
              title="Sign in"
              onPress={verifyCode}
              busy={busy}
              disabled={code.replace(/\D/g, '').length < 6}
            />

            <Pressable
              onPress={() => {
                setCode('');
                setError(null);
                setMode('password');
              }}
              hitSlop={10}
              accessibilityRole="button"
            >
              <Muted style={{ textAlign: 'center', textDecorationLine: 'underline' }}>
                Use a password instead
              </Muted>
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
