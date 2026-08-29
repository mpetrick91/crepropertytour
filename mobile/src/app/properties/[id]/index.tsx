import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Dimensions, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StatusBar } from 'expo-status-bar';

import { AerialCard } from '@/components/aerial';
import { PhotoGallery, type GalleryPhoto } from '@/components/photo-gallery';
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
import { signedPropertyPhotoUrls } from '@/lib/photos';
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
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;

    const [{ data }, { data: photoRows }] = await Promise.all([
      supabase.from('properties').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('property_photos')
        .select('id, storage_path, caption, position')
        .eq('property_id', id)
        .order('position'),
    ]);

    setProperty(data ?? null);

    const rows = photoRows ?? [];
    const urls = await signedPropertyPhotoUrls(rows.map((row) => row.storage_path));
    setPhotos(
      rows.map((row) => ({
        id: row.id,
        uri: urls.get(row.storage_path) ?? null,
        caption: row.caption,
      })),
    );

    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /**
   * Camera takes one; the library takes as many as are selected.
   *
   * Each photo is uploaded and its row written before the next begins, so a
   * failure part-way leaves the ones already saved intact rather than rolling
   * back work the broker watched succeed.
   */
  async function addPhotos(source: 'camera' | 'library') {
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
          : 'Photo access is off for this app. Turn it on in Settings to choose photos.',
      );
      return;
    }

    const picker =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.7,
            allowsMultipleSelection: true,
            selectionLimit: 12,
          });

    const assets = picker.canceled ? [] : picker.assets;
    if (!assets.length) return;

    setUploading(true);
    let position = photos.length;

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not signed in.');

      for (const asset of assets) {
        const response = await fetch(asset.uri);
        const bytes = await response.arrayBuffer();
        const path = propertyPhotoPath(user.user.id, id, asset.fileName ?? 'photo.jpg');

        const { error: uploadError } = await supabase.storage
          .from(PROPERTY_PHOTOS_BUCKET)
          .upload(path, bytes, { contentType: asset.mimeType ?? 'image/jpeg', upsert: false });
        if (uploadError) throw uploadError;

        const { error: rowError } = await supabase.from('property_photos').insert({
          property_id: id,
          storage_path: path,
          position,
          width: asset.width ?? null,
          height: asset.height ?? null,
          size_bytes: bytes.byteLength,
        });

        if (rowError) {
          // Don't leave an orphan object behind if the row is refused.
          await supabase.storage.from(PROPERTY_PHOTOS_BUCKET).remove([path]);
          throw rowError;
        }

        position += 1;
      }

      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? humanError(caught.message) : 'Could not save those photos.',
      );
      // Whatever did land should still show.
      await load();
    } finally {
      setUploading(false);
    }
  }

  /** The object goes only after the row that points at it is gone. */
  async function removePhoto(photoId: string) {
    const { data: row } = await supabase
      .from('property_photos')
      .select('storage_path')
      .eq('id', photoId)
      .maybeSingle();

    const { error: deleteError } = await supabase
      .from('property_photos')
      .delete()
      .eq('id', photoId);

    if (deleteError) {
      setError(humanError(deleteError.message));
      return;
    }

    if (row?.storage_path) {
      await supabase.storage.from(PROPERTY_PHOTOS_BUCKET).remove([row.storage_path]);
    }
    await load();
  }

  /**
   * Promoting a photo renumbers the whole gallery, so the order stays a
   * sequence rather than accumulating gaps and ties.
   */
  async function makeCover(photoId: string) {
    const reordered = [photoId, ...photos.filter((photo) => photo.id !== photoId).map((p) => p.id)];

    for (const [index, currentId] of reordered.entries()) {
      const { error: updateError } = await supabase
        .from('property_photos')
        .update({ position: index })
        .eq('id', currentId);
      if (updateError) {
        setError(humanError(updateError.message));
        break;
      }
    }
    await load();
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

          <PhotoGallery
            photos={photos}
            uploading={uploading}
            onAdd={addPhotos}
            onRemove={removePhoto}
            onMakeCover={makeCover}
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
