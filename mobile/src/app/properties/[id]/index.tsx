import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Dimensions, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StatusBar } from 'expo-status-bar';

import { AerialCard } from '@/components/aerial';
import {
  Body,
  BodyStrong,
  Button,
  Caption,
  Card,
  ErrorText,
  InternalNote,
  Label,
  Muted,
  SectionHeader,
  Touchable,
} from '@/components/ui';
import { cityState, formatRate, formatSf, humanError } from '@/lib/format';
import { signedPropertyPhotoUrl } from '@/lib/photos';
import { supabase } from '@/lib/supabase';
import { elevation, radius, space, useIsDark, useTheme } from '@/lib/theme';
import { PROPERTY_PHOTOS_BUCKET, propertyPhotoPath, type Property } from '@/lib/types';

const TYPE_LABEL: Record<string, string> = {
  office: 'Office',
  industrial: 'Industrial',
  flex: 'Flex',
  retail: 'Retail',
  land: 'Land',
  other: 'Other',
};

export default function PropertyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTheme();
  const insets = useSafeAreaInsets();

  // A little under half the screen: enough to read a site plan, not so much
  // that the numbers below it need a scroll to reach.
  const heroHeight = Math.max(280, Math.round(Dimensions.get('window').height * 0.42));

  const [property, setProperty] = useState<Property | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from('properties').select('*').eq('id', id).maybeSingle();
    setProperty(data ?? null);
    setPhotoUrl(data?.photo_path ? await signedPropertyPhotoUrl(data.photo_path) : null);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /**
   * Camera or library, then straight into the private bucket. The row stores
   * the object key, never a URL -- reads go through a signed link that expires.
   */
  async function attachPhoto(source: 'camera' | 'library') {
    if (!id || !property) return;
    setError(null);

    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError(
        source === 'camera'
          ? 'Camera access is off for this app. Turn it on in Settings to take a photo.'
          : 'Photo access is off for this app. Turn it on in Settings to choose a photo.',
      );
      return;
    }

    const picker =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.7,
          });

    const asset = picker.canceled ? null : picker.assets[0];
    if (!asset) return;

    setUploading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not signed in.');

      const response = await fetch(asset.uri);
      const bytes = await response.arrayBuffer();
      const path = propertyPhotoPath(user.user.id, id, asset.fileName ?? 'photo.jpg');

      const { error: uploadError } = await supabase.storage
        .from(PROPERTY_PHOTOS_BUCKET)
        .upload(path, bytes, { contentType: asset.mimeType ?? 'image/jpeg', upsert: false });
      if (uploadError) throw uploadError;

      const { error: rowError } = await supabase
        .from('properties')
        .update({ photo_path: path })
        .eq('id', id);
      if (rowError) {
        // Don't leave an orphan object behind if the row is refused.
        await supabase.storage.from(PROPERTY_PHOTOS_BUCKET).remove([path]);
        throw rowError;
      }

      // The old photo is only unreachable once the row no longer points at it.
      if (property.photo_path) {
        await supabase.storage.from(PROPERTY_PHOTOS_BUCKET).remove([property.photo_path]);
      }

      await load();
    } catch (caught) {
      setError(caught instanceof Error ? humanError(caught.message) : 'Could not save that photo.');
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }

  if (!property) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: space.xl }}>
        <BodyStrong>Building not found.</BodyStrong>
      </View>
    );
  }

  const address = [property.address_line1, cityState(property.city, property.state)]
    .filter(Boolean)
    .join(', ');

  const brochure = property.brochure_url;

  const specs = [
    { label: 'Type', value: TYPE_LABEL[property.property_type ?? 'other'] },
    { label: 'Available', value: formatSf(property.available_sf) },
    { label: 'Building', value: formatSf(property.building_size_sf) },
    { label: 'Office', value: formatSf(property.office_sf) },
    { label: 'Clear height', value: property.clear_height_ft ? `${property.clear_height_ft}′` : null },
    { label: 'Docks', value: property.dock_doors != null ? `${property.dock_doors}` : null },
    { label: 'Drive-in', value: property.drive_in_doors != null ? `${property.drive_in_doors}` : null },
    { label: 'Power', value: property.power },
    { label: 'Year built', value: property.year_built ? `${property.year_built}` : null },
    { label: 'Parking', value: property.parking },
    { label: 'Term', value: property.lease_term },
  ].filter((spec) => spec.value);

  const rate = formatRate(property.rent_rate, property.rent_type);

  return (
    <View style={{ flex: 1, backgroundColor: t.canvas }}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── The site, given the top of the screen ────────────────────── */}

        <View style={{ height: heroHeight }}>
          <AerialCard
            bleed
            height={heroHeight}
            address={address || property.address_line1}
            latitude={property.latitude}
            longitude={property.longitude}
          />

          {/* Darkens just enough for white controls to sit on whatever the
              imagery happens to be underneath them. */}
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(6,13,28,0.6)', 'transparent']}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, height: insets.top + 76 }}
          />

          <View
            style={{
              position: 'absolute',
              top: insets.top + space.sm,
              left: space.lg,
              right: space.lg,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <OverlayButton icon="chevron-back" label="Go back" onPress={() => router.back()} />
            <View style={{ flex: 1 }} />
            <OverlayButton
              icon="create-outline"
              label="Edit building"
              onPress={() => router.push(`/properties/${property.id}/edit`)}
            />
          </View>
        </View>

        <View style={{ padding: space.lg, gap: space.lg }}>
          <View style={{ gap: 2 }}>
            <Text
              style={{ fontSize: 25, fontWeight: '800', letterSpacing: -0.5, color: t.text }}
            >
              {property.name ?? property.address_line1}
            </Text>
            <Muted>{address || property.address_line1}</Muted>
          </View>

          <ErrorText>{error}</ErrorText>

          {/* ── The brochure, on its own ───────────────────────────────── */}

          {brochure ? (
            <Button
              title="Open brochure"
              icon="document-text"
              onPress={() => Linking.openURL(brochure).catch(() => {})}
            />
          ) : (
            <Button
              title="Add a brochure link"
              icon="add"
              variant="secondary"
              onPress={() => router.push(`/properties/${property.id}/edit`)}
            />
          )}

          {/* ── Everything else, in reading order ──────────────────────── */}

          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Headline
              label="Available"
              value={formatSf(property.available_sf) ?? '—'}
              icon="resize-outline"
            />
            <Headline label="Asking" value={rate ?? '—'} icon="pricetag-outline" accent />
          </View>

          <PhotoPanel
            uri={photoUrl}
            uploading={uploading}
            onPick={attachPhoto}
            hasPhoto={Boolean(property.photo_path)}
          />

          {specs.length ? (
            <>
              <SectionHeader title="Specs" />
              <Card style={{ gap: 0 }}>
                {specs.map((spec, index) => (
                  <View
                    key={spec.label}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: space.md,
                      borderTopWidth: index === 0 ? 0 : 1,
                      borderTopColor: t.border,
                    }}
                  >
                    <Muted>{spec.label}</Muted>
                    <BodyStrong style={{ fontVariant: ['tabular-nums'] }}>{spec.value}</BodyStrong>
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          {property.description ? (
            <Card style={{ gap: space.xs }}>
              <Label>About</Label>
              <Body>{property.description}</Body>
            </Card>
          ) : null}

          {property.listing_broker_name ? (
            <Card style={{ gap: space.md }}>
              <Label>Listing broker</Label>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <View style={{ flex: 1 }}>
                  <BodyStrong>{property.listing_broker_name}</BodyStrong>
                  {property.listing_broker_company ? (
                    <Caption>{property.listing_broker_company}</Caption>
                  ) : null}
                </View>
                {property.listing_broker_phone ? (
                  <ContactButton
                    icon="call"
                    label={`Call ${property.listing_broker_name}`}
                    url={`tel:${property.listing_broker_phone}`}
                  />
                ) : null}
                {property.listing_broker_email ? (
                  <ContactButton
                    icon="mail"
                    label={`Email ${property.listing_broker_name}`}
                    url={`mailto:${property.listing_broker_email}`}
                  />
                ) : null}
              </View>
            </Card>
          ) : null}

          {property.notes ? <InternalNote>{property.notes}</InternalNote> : null}
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * A control that has to stay legible over whatever the aerial happens to show
 * underneath it -- hence a solid scrim behind the glyph rather than a tint.
 */
function OverlayButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Touchable
      onPress={onPress}
      accessibilityLabel={label}
      haptic="medium"
      scaleTo={0.9}
      style={{
        width: 40,
        height: 40,
        borderRadius: radius.pill,
        backgroundColor: 'rgba(6,13,28,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={icon} size={21} color="#fff" />
    </Touchable>
  );
}

/**
 * The building's own photograph, or an invitation to take one.
 *
 * A property page opens on an image because that is how a building is
 * recognised. With nothing uploaded the panel does not pretend otherwise -- it
 * asks, with the two ways of answering side by side.
 */
function PhotoPanel({
  uri,
  uploading,
  hasPhoto,
  onPick,
}: {
  uri: string | null;
  uploading: boolean;
  hasPhoto: boolean;
  onPick: (source: 'camera' | 'library') => void;
}) {
  const t = useTheme();
  const isDark = useIsDark();

  if (uri) {
    return (
      <View style={[{ borderRadius: radius.lg, overflow: 'hidden' }, elevation(2, isDark)]}>
        <Image
          source={{ uri }}
          style={{ width: '100%', height: 220 }}
          contentFit="cover"
          transition={200}
          accessibilityLabel="Photo of this building"
        />
        <Touchable
          onPress={() => onPick('library')}
          haptic="medium"
          scaleTo={0.9}
          accessibilityLabel="Replace photo"
          style={{
            position: 'absolute',
            right: space.md,
            bottom: space.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: 'rgba(6,13,28,0.68)',
            paddingHorizontal: space.md,
            paddingVertical: 8,
            borderRadius: radius.pill,
          }}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="camera" size={14} color="#fff" />
          )}
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
            {uploading ? 'Saving…' : 'Replace'}
          </Text>
        </Touchable>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={isDark ? ['#172236', '#0C1422'] : ['#E9EFF8', '#DCE5F2']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        height: 190,
        borderRadius: radius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.md,
        padding: space.lg,
        overflow: 'hidden',
      }}
    >
      {uploading ? (
        <>
          <ActivityIndicator color={t.primary} />
          <Muted>Saving the photo…</Muted>
        </>
      ) : (
        <>
          <Ionicons name="image-outline" size={30} color={t.textFaint} />
          <Muted style={{ textAlign: 'center' }}>
            {hasPhoto ? 'That photo could not be loaded.' : 'No photo of this building yet.'}
          </Muted>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button title="Take one" icon="camera" size="md" onPress={() => onPick('camera')} />
            <Button
              title="Choose"
              icon="images-outline"
              size="md"
              variant="secondary"
              onPress={() => onPick('library')}
            />
          </View>
        </>
      )}
    </LinearGradient>
  );
}

/** A number worth reading from across a parking lot. */
function Headline({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: boolean;
}) {
  const t = useTheme();
  const isDark = useIsDark();

  return (
    <View
      style={[
        {
          flex: 1,
          gap: 3,
          padding: space.lg,
          borderRadius: radius.lg,
          backgroundColor: accent ? t.accentSoft : t.surface,
        },
        elevation(1, isDark),
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Ionicons name={icon} size={13} color={accent ? t.accentInk : t.textMuted} />
        <Text
          style={{
            fontSize: 10.5,
            fontWeight: '800',
            letterSpacing: 1,
            color: accent ? t.accentInk : t.textFaint,
          }}
        >
          {label.toUpperCase()}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        style={{
          fontSize: 21,
          fontWeight: '800',
          letterSpacing: -0.5,
          color: accent ? t.accentInk : t.text,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function ContactButton({
  icon,
  label,
  url,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  url: string;
}) {
  const t = useTheme();
  return (
    <Touchable
      onPress={() => Linking.openURL(url).catch(() => {})}
      accessibilityLabel={label}
      scaleTo={0.9}
      style={{
        width: 42,
        height: 42,
        borderRadius: radius.pill,
        backgroundColor: t.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={icon} size={19} color={t.primary} />
    </Touchable>
  );
}
