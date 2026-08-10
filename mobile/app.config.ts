import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Injects config from .env into the compiled app.
 *
 * Read at build time and baked into `extra`, which is how Constants.expoConfig
 * reaches it on device. These are the same publishable values the web app ships
 * to the browser -- no secret ever belongs here, because anything in `extra` is
 * readable by anyone who downloads the app.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  extra: {
    ...config.extra,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    siteUrl: process.env.EXPO_PUBLIC_SITE_URL ?? 'https://crepropertytour.vercel.app',
    eas: config.extra?.eas,
  },
});
