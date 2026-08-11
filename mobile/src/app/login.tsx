import * as Linking from 'expo-linking';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { Body, Button, ErrorText, Field, Muted, Title } from '@/components/ui';
import { humanError } from '@/lib/format';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { spacing, useTheme } from '@/lib/theme';

export default function LoginScreen() {
  const { isBroker } = useSession();
  const t = useTheme();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'verifying'>('idle');
  const [error, setError] = useState<string | null>(null);

  if (isBroker) return <Redirect href="/tours" />;

  function describe(message: string): string {
    return /signups not allowed|not found|user not found/i.test(message)
      ? 'That email is not set up as a broker on this app. Check the spelling, or add the account in Supabase under Authentication → Users.'
      : humanError(message);
  }

  async function sendCode() {
    setError(null);
    setStatus('sending');

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        // The same email carries both a tappable link and a six-digit code.
        // The link only works in a real build that owns the URL scheme, so the
        // code is what makes this usable in Expo Go and anywhere else.
        emailRedirectTo: Linking.createURL('/'),
        // Broker accounts are added deliberately in the Supabase dashboard.
        // Enforced here rather than by disabling signups project-wide, because
        // that switch would also block the anonymous sessions guests need.
        shouldCreateUser: false,
      },
    });

    if (signInError) {
      setError(describe(signInError.message));
      setStatus('idle');
      return;
    }

    setStatus('sent');
  }

  async function verifyCode() {
    const token = code.replace(/\D/g, '');
    if (token.length < 6) return;

    setError(null);
    setStatus('verifying');

    // Signs in without any redirect at all, which is why it works on a device
    // that cannot receive the deep link.
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
      setStatus('sent');
      return;
    }
    // The session listener in SessionProvider redirects from here.
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <Title>Broker sign-in</Title>
        <Body style={{ color: t.textMuted }}>
          Clients don&apos;t need an account — they just open the tour link you send them.
        </Body>

        {status === 'sent' || status === 'verifying' ? (
          <>
            <View
              style={{
                backgroundColor: t.surface,
                borderRadius: 10,
                padding: spacing.lg,
                gap: spacing.xs,
              }}
            >
              <Body style={{ fontWeight: '600' }}>Check your email.</Body>
              <Muted>
                Sent to {email.trim()}. Tap the link in it, or type the 6-digit code below —
                either works.
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
              busy={status === 'verifying'}
              disabled={code.replace(/\D/g, '').length < 6}
            />

            <Pressable
              onPress={() => {
                setCode('');
                setError(null);
                setStatus('idle');
              }}
              hitSlop={10}
              accessibilityRole="button"
            >
              <Muted style={{ textAlign: 'center', textDecorationLine: 'underline' }}>
                Use a different email
              </Muted>
            </Pressable>
          </>
        ) : (
          <>
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
              returnKeyType="go"
              onSubmitEditing={sendCode}
            />
            <ErrorText>{error}</ErrorText>
            <Button
              title="Email me a sign-in code"
              onPress={sendCode}
              busy={status === 'sending'}
              disabled={!email.trim()}
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
