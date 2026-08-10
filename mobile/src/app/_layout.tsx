import { Stack } from 'expo-router';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

/**
 * Magic-link sign-in returns to the app as a deep link carrying the tokens in
 * the URL fragment. There is no address bar for supabase-js to read, so the
 * session has to be handed over by hand -- which is why the client is created
 * with detectSessionInUrl: false.
 */
function useAuthDeepLinks() {
  useEffect(() => {
    async function handle(url: string) {
      const fragment = url.split('#')[1];
      if (!fragment) return;

      const params = new URLSearchParams(fragment);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (!access_token || !refresh_token) return;

      await supabase.auth.setSession({ access_token, refresh_token });
    }

    // Cold start: the link that launched the app.
    Linking.getInitialURL().then((url) => {
      if (url) handle(url);
    });

    // Warm start: the app was already running.
    const subscription = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => subscription.remove();
  }, []);
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const t = useTheme();
  useAuthDeepLinks();

  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: t.background },
            headerTintColor: t.text,
            headerTitleStyle: { color: t.text },
            contentStyle: { backgroundColor: t.background },
            headerBackButtonDisplayMode: 'minimal',
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ title: 'Sign in' }} />
          <Stack.Screen name="t/[token]" options={{ title: 'Tour' }} />
          <Stack.Screen name="tours/index" options={{ title: 'Tours' }} />
          <Stack.Screen name="tours/new" options={{ title: 'New tour', presentation: 'modal' }} />
          <Stack.Screen name="tours/[id]/index" options={{ title: 'Tour' }} />
          <Stack.Screen name="tours/[id]/recap" options={{ title: 'Recap' }} />
          <Stack.Screen name="properties/index" options={{ title: 'Properties' }} />
          <Stack.Screen
            name="properties/new"
            options={{ title: 'Add property', presentation: 'modal' }}
          />
          <Stack.Screen name="properties/[id]" options={{ title: 'Property' }} />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
