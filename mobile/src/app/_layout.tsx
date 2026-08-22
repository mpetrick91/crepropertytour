import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

/**
 * A magic-link sign-in returns as a deep link carrying tokens in the URL
 * fragment. There is no address bar for supabase-js to read, so the session is
 * handed over by hand -- which is why the client sets detectSessionInUrl:false.
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

    Linking.getInitialURL().then((url) => {
      if (url) handle(url);
    });

    const subscription = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => subscription.remove();
  }, []);
}

export default function RootLayout() {
  const t = useTheme();
  useAuthDeepLinks();

  return (
    <SafeAreaProvider>
      <SessionProvider>
        <Stack
          screenOptions={{
            // Every screen paints its own gradient header, so the navigator's
            // own bar would only be a second, competing one.
            headerShown: false,
            contentStyle: { backgroundColor: t.canvas },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="login" />
          <Stack.Screen name="t/[token]" />
          <Stack.Screen name="tours/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="tours/[id]/index" />
          <Stack.Screen name="tours/[id]/recap" />
          <Stack.Screen name="properties/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="properties/[id]/index" />
          <Stack.Screen name="properties/[id]/edit" />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
