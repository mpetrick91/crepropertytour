import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Platform, Text, View } from 'react-native';

import { siteUrl } from '@/lib/supabase';
import { radius, space, useTheme } from '@/lib/theme';

import { haptic, Touchable } from './ui';

/**
 * Satellite imagery for a building.
 *
 * Aerial tiles come from a provider that charges for them, so the imagery only
 * appears once a key is configured. The key is never in the app: the request
 * goes to this product's own site, which holds the key as a server environment
 * variable and forwards it. A key shipped inside an app is a key anyone who
 * downloads the app can read and spend, and static map requests carry no
 * bundle id or referrer for the provider to check against, so there is no way
 * to restrict one that would actually hold.
 *
 * Until the site has a key, the card still does the part that needs none: one
 * tap opens the phone's own maps app at the address, in satellite mode, where
 * the imagery is already licensed and the gestures are familiar. That tap
 * keeps working after the imagery arrives.
 */

/**
 * The site is asked for the picture. `null` when the building has no
 * coordinates, since the endpoint deliberately accepts only a coordinate pair
 * -- a public endpoint that forwarded free text could be pointed at billable
 * requests other than map tiles.
 */
function aerialUrl(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  width: number,
  height: number,
): string | null {
  if (latitude == null || longitude == null) return null;

  const params = new URLSearchParams({
    lat: `${latitude}`,
    lng: `${longitude}`,
    w: `${Math.min(Math.round(width), 640)}`,
    h: `${Math.min(Math.round(height), 640)}`,
  });
  return `${siteUrl()}/api/aerial?${params.toString()}`;
}

/**
 * A local key still works, for trying it out before the site is configured.
 * Not the path a shipped app takes.
 */
function devDirectUrl(point: string, width: number, height: number): string | null {
  const key = (Constants.expoConfig?.extra as Record<string, string | undefined>)?.mapsKey;
  if (!key || !__DEV__) return null;

  const params = new URLSearchParams({
    center: point,
    zoom: '18',
    size: `${Math.round(width)}x${Math.round(height)}`,
    scale: '2',
    maptype: 'satellite',
    key,
  });
  params.append('markers', `color:0xFAA61A|${point}`);
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

/**
 * Deep link into the maps app, in satellite mode.
 *
 * Apple Maps takes `t=k` for satellite; Google takes the `!3m1!1e3` data
 * parameter, and only when it is given a coordinate -- an address search drops
 * back to the default map, which is still the right place, just not the right
 * layer.
 */
function mapsLink(address: string, latitude: number | null, longitude: number | null): string {
  const point = latitude != null && longitude != null ? `${latitude},${longitude}` : null;

  if (Platform.OS === 'ios') {
    return point
      ? `http://maps.apple.com/?ll=${point}&t=k&q=${encodeURIComponent(address)}`
      : `http://maps.apple.com/?q=${encodeURIComponent(address)}&t=k`;
  }

  return point
    ? `https://www.google.com/maps/@${point},250m/data=!3m1!1e3`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function AerialCard({
  address,
  latitude,
  longitude,
  height = 190,
  bleed,
}: {
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  height?: number;
  /** Full width, square corners -- for use as the top of a screen. */
  bleed?: boolean;
}) {
  const t = useTheme();
  // Set when the image fails, so a site with no key configured falls back to
  // the drawing rather than to a broken frame.
  const [imageFailed, setImageFailed] = useState(false);

  const point = latitude != null && longitude != null ? `${latitude},${longitude}` : null;
  const source =
    (point ? devDirectUrl(point, 640, 400) : null) ?? aerialUrl(latitude, longitude, 640, 400);
  const inline = source && !imageFailed ? source : null;

  function open() {
    haptic('medium');
    Linking.openURL(mapsLink(address, latitude ?? null, longitude ?? null)).catch(() => {});
  }

  return (
    <Touchable
      onPress={open}
      haptic="none"
      scaleTo={bleed ? 1 : 0.985}
      accessibilityLabel={`Open ${address} in satellite view`}
      style={{
        height,
        borderRadius: bleed ? 0 : radius.lg,
        overflow: 'hidden',
        backgroundColor: t.primary,
      }}
    >
      {inline ? (
        <Image
          source={{ uri: inline }}
          style={{ flex: 1 }}
          contentFit="cover"
          transition={200}
          onError={() => setImageFailed(true)}
          accessibilityLabel={`Satellite view of ${address}`}
        />
      ) : (
        <AerialPlaceholder />
      )}

      {/* Reads over both the drawn placeholder and a real aerial. */}
      <LinearGradient
        colors={['transparent', 'rgba(6,13,28,0.72)']}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: space.lg,
          paddingTop: space.xxl,
          paddingBottom: space.lg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: 'rgba(255,255,255,0.72)',
              fontSize: 10.5,
              fontWeight: '800',
              letterSpacing: 1,
            }}
          >
            SATELLITE
          </Text>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
            {inline ? 'Tap to explore' : 'Open aerial view'}
          </Text>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: 'rgba(255,255,255,0.95)',
            paddingHorizontal: space.md,
            paddingVertical: 8,
            borderRadius: radius.pill,
          }}
        >
          <Ionicons name="navigate" size={14} color={t.primary} />
          <Text style={{ color: t.primary, fontSize: 13.5, fontWeight: '800' }}>Maps</Text>
        </View>
      </LinearGradient>
    </Touchable>
  );
}

/**
 * Stands in for the aerial when there is no key.
 *
 * Deliberately abstract -- a grid of parcels and a road, not a fake photograph.
 * Dressing it up to look like real imagery would be worse than showing nothing,
 * because a broker would read it as the site.
 */
function AerialPlaceholder() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0E2A22' }}>
      <LinearGradient
        colors={['#123B2C', '#0B2118']}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />

      {/* Parcel grid */}
      <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', opacity: 0.5 }}>
        {Array.from({ length: 40 }, (_, index) => (
          <View
            key={index}
            style={{
              width: '12.5%',
              height: '20%',
              borderWidth: 0.5,
              borderColor: 'rgba(255,255,255,0.09)',
            }}
          />
        ))}
      </View>

      {/* A road, and the building sitting on it */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '58%',
          height: 14,
          backgroundColor: 'rgba(255,255,255,0.10)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: '26%',
          top: '24%',
          width: '30%',
          height: '28%',
          borderRadius: 3,
          backgroundColor: 'rgba(226,236,255,0.22)',
          borderWidth: 1,
          borderColor: 'rgba(250,166,26,0.55)',
        }}
      />
    </View>
  );
}
