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
  experiments: {
    ...config.experiments,
    // The browser preview is served from <site>/app/, not the root, so the
    // export has to prefix every asset and bundle URL. Unset for device
    // builds, where there is no such prefix.
    ...(process.env.EXPO_WEB_BASE_URL ? { baseUrl: process.env.EXPO_WEB_BASE_URL } : {}),
  },
  extra: {
    ...config.extra,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    siteUrl: process.env.EXPO_PUBLIC_SITE_URL ?? 'https://crepropertytour.vercel.app',
    // Optional: a Google Maps key turns the aerial card into a live satellite
    // image. Without it the card opens the phone's maps app instead.
    mapsKey: process.env.EXPO_PUBLIC_MAPS_KEY,
    // Set to 'off' to run against the real Supabase project and its sign-in.
    // Anything else (including unset) means demo mode in development.
    demoMode: process.env.EXPO_PUBLIC_DEMO_MODE,
    // Development only -- see devCredentials() in src/lib/session.tsx. Unset
    // in .env and these are undefined, which turns the behaviour off.
    devEmail: process.env.EXPO_PUBLIC_DEV_EMAIL,
    devPassword: process.env.EXPO_PUBLIC_DEV_PASSWORD,
    eas: config.extra?.eas,
  },
});
