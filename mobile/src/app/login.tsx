import * as Linking from 'expo-linking';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { Body, Button, ErrorText, Field, Muted, Title } from '@/components/ui';
import { humanError } from '@/lib/format';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { spacing, useTheme } from '@/lib/theme';

export default function LoginScreen() {
  const { isBroker } = useSession();
  const t = useTheme();

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  if (isBroker) return <Redirect href="/tours" />;

  async function signIn() {
    setError(null);
    setStatus('sending');

    // Returns to the app itself rather than a web page: on device the deep link
    // is what carries the session back, handled in app/_layout.tsx.
    const redirectTo = Linking.createURL('/');

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: redirectTo,
        // Broker accounts are added deliberately in the Supabase dashboard.
        // Enforced here rather than by disabling signups project-wide, because
        // that switch would also block the anonymous sessions guests need.
        shouldCreateUser: false,
      },
    });

    if (signInError) {
      setError(
        /signups not allowed|not found/i.test(signInError.message)
          ? 'That email is not set up as a broker on this app. Check the spelling, or add the account in Supabase under Authentication → Users.'
          : humanError(signInError.message),
      );
      setStatus('idle');
      return;
    }

    setStatus('sent');
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

        {status === 'sent' ? (
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
              We sent a sign-in link to {email.trim()}. Open it on this phone and it will
              bring you straight back here.
            </Muted>
          </View>
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
              onSubmitEditing={signIn}
            />
            <ErrorText>{error}</ErrorText>
            <Button
              title="Email me a sign-in link"
              onPress={signIn}
              busy={status === 'sending'}
              disabled={!email.trim()}
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
