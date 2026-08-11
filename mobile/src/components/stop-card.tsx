import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Linking, Platform, ScrollView, View } from 'react-native';

import {
  BodyStrong,
  Button,
  Caption,
  Card,
  ErrorText,
  Field,
  Heading,
  Muted,
  Stars,
  StopNumber,
  Touchable,
  haptic,
} from '@/components/ui';
import { cityState, formatRate, formatSf, humanError } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { radius, space, useTheme } from '@/lib/theme';
import { TOUR_PHOTOS_BUCKET, tourPhotoPath, type GuestProperty } from '@/lib/types';

export type NoteView = {
  id: string;
  body: string;
  rating: number | null;
  authorName: string;
  isMine: boolean;
};

export type PhotoView = {
  id: string;
  url: string | null;
  caption: string | null;
  isMine: boolean;
};

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export function StopCard({
  index,
  tourId,
  stopId,
  participantId,
  canAddNotes,
  canAddPhotos,
  property,
  notes,
  photos,
  onChanged,
}: {
  index: number;
  tourId: string;
  stopId: string;
  participantId: string;
  canAddNotes: boolean;
  canAddPhotos: boolean;
  property: GuestProperty | null;
  notes: NoteView[];
  photos: PhotoView[];
  onChanged: () => void | Promise<void>;
}) {
  const t = useTheme();
  const [body, setBody] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = property?.name ?? property?.address_line1 ?? 'Property';
  const address = [property?.address_line1, cityState(property?.city, property?.state)]
    .filter(Boolean)
    .join(', ');

  const facts = [
    formatSf(property?.available_sf),
    formatRate(property?.rent_rate, property?.rent_type),
    property?.clear_height_ft ? `${property.clear_height_ft}′ clear` : null,
    property?.dock_doors ? `${property.dock_doors} docks` : null,
  ].filter(Boolean) as string[];

  const mine = notes.find((note) => note.isMine);

  function openDirections() {
    if (!address) return;
    const query = encodeURIComponent(address);
    const url =
      Platform.OS === 'ios'
        ? `http://maps.apple.com/?daddr=${query}`
        : `https://www.google.com/maps/search/?api=1&query=${query}`;
    Linking.openURL(url).catch(() => setError('Could not open maps.'));
  }

  async function addNote() {
    if (!body.trim()) return;
    setBusy(true);
    setError(null);

    const { error: insertError } = await supabase.from('stop_notes').insert({
      tour_id: tourId,
      stop_id: stopId,
      participant_id: participantId,
      body: body.trim(),
      rating,
    });

    if (insertError) {
      setError(humanError(insertError.message));
      setBusy(false);
      return;
    }

    haptic('success');
    setBody('');
    setRating(null);
    setComposing(false);
    setBusy(false);
    await onChanged();
  }

  function confirmDeleteNote(noteId: string) {
    Alert.alert('Delete this note?', 'It will be removed for everyone on the tour.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error: deleteError } = await supabase.from('stop_notes').delete().eq('id', noteId);
          if (deleteError) setError(humanError(deleteError.message));
          else await onChanged();
        },
      },
    ]);
  }

  async function pickPhoto(source: 'camera' | 'library') {
    setError(null);

    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError(
        source === 'camera'
          ? 'Camera access is off for this app. Turn it on in your phone settings to take photos.'
          : 'Photo access is off for this app. Turn it on in your phone settings.',
      );
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.7, exif: false })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] });

    if (result.canceled || !result.assets?.length) return;
    await upload(result.assets[0]);
  }

  async function upload(asset: ImagePicker.ImagePickerAsset) {
    setUploading(true);
    setError(null);

    try {
      const response = await fetch(asset.uri);
      const bytes = await response.arrayBuffer();

      if (bytes.byteLength > MAX_UPLOAD_BYTES) {
        setError('That photo is larger than 15 MB.');
        return;
      }

      const filename = asset.fileName ?? `photo-${Date.now()}.jpg`;
      // The tour id has to lead the key -- that is what the storage policies
      // parse to decide whether this person may write here.
      const path = tourPhotoPath(tourId, stopId, filename);

      const { error: uploadError } = await supabase.storage
        .from(TOUR_PHOTOS_BUCKET)
        .upload(path, bytes, { contentType: asset.mimeType ?? 'image/jpeg', upsert: false });

      if (uploadError) {
        setError(humanError(uploadError.message));
        return;
      }

      const { error: rowError } = await supabase.from('stop_photos').insert({
        tour_id: tourId,
        stop_id: stopId,
        participant_id: participantId,
        storage_path: path,
        size_bytes: bytes.byteLength,
        width: asset.width ?? null,
        height: asset.height ?? null,
      });

      if (rowError) {
        // Don't leave an orphan object behind if the row is refused.
        await supabase.storage.from(TOUR_PHOTOS_BUCKET).remove([path]);
        setError(humanError(rowError.message));
        return;
      }

      haptic('success');
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? humanError(caught.message) : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  function choosePhotoSource() {
    if (Platform.OS === 'web') {
      pickPhoto('library');
      return;
    }
    Alert.alert('Add a photo', undefined, [
      { text: 'Take photo', onPress: () => pickPhoto('camera') },
      { text: 'Choose from library', onPress: () => pickPhoto('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <Card level={2} style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header ------------------------------------------------------- */}
      <View style={{ padding: space.lg, gap: space.md }}>
        <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
          <StopNumber n={index + 1} />
          <View style={{ flex: 1, gap: 3 }}>
            <Heading>{title}</Heading>
            {address ? (
              <Touchable
                onPress={openDirections}
                accessibilityRole="link"
                accessibilityLabel={`Directions to ${address}`}
                scaleTo={0.98}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Ionicons name="navigate-circle" size={16} color={t.accent} />
                <Muted style={{ color: t.accent, flex: 1 }}>{address}</Muted>
              </Touchable>
            ) : null}
          </View>
        </View>

        {facts.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {facts.map((fact) => (
              <View
                key={fact}
                style={{
                  backgroundColor: t.surfaceSunken,
                  borderRadius: radius.sm,
                  paddingHorizontal: space.md,
                  paddingVertical: 6,
                }}
              >
                <Caption style={{ color: t.textMuted, fontVariant: ['tabular-nums'] }}>
                  {fact}
                </Caption>
              </View>
            ))}
          </View>
        ) : null}

        {property?.description ? <Muted>{property.description}</Muted> : null}
      </View>

      {/* Photos ------------------------------------------------------- */}
      {photos.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.lg }}
        >
          {photos.map((photo) =>
            photo.url ? (
              <Image
                key={photo.id}
                source={{ uri: photo.url }}
                style={{ width: 132, height: 132, borderRadius: radius.md }}
                contentFit="cover"
                transition={200}
                accessibilityLabel={photo.caption ?? 'Tour photo'}
              />
            ) : (
              <View
                key={photo.id}
                style={{
                  width: 132,
                  height: 132,
                  borderRadius: radius.md,
                  backgroundColor: t.surfaceSunken,
                }}
              />
            ),
          )}
        </ScrollView>
      ) : null}

      {/* Notes -------------------------------------------------------- */}
      {notes.length ? (
        <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.sm }}>
          {notes.map((note) => (
            <View
              key={note.id}
              style={{
                backgroundColor: note.isMine ? t.accentSoft : t.surfaceSunken,
                borderRadius: radius.md,
                padding: space.md,
                gap: 4,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: space.sm,
                }}
              >
                <Caption style={{ color: note.isMine ? t.accent : t.textMuted, fontWeight: '800' }}>
                  {note.isMine ? 'YOU' : note.authorName.toUpperCase()}
                </Caption>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  {note.rating ? <Stars value={note.rating} size={13} /> : null}
                  {note.isMine ? (
                    <Touchable
                      onPress={() => confirmDeleteNote(note.id)}
                      accessibilityLabel="Delete your note"
                      scaleTo={0.85}
                      haptic="warning"
                      style={{ padding: 4 }}
                    >
                      <Ionicons name="trash-outline" size={15} color={t.textFaint} />
                    </Touchable>
                  ) : null}
                </View>
              </View>
              <BodyStrong style={{ fontSize: 15, fontWeight: '400' }}>{note.body}</BodyStrong>
            </View>
          ))}
        </View>
      ) : null}

      {/* Compose ------------------------------------------------------ */}
      {canAddNotes && composing ? (
        <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.md }}>
          <Field
            label="Your thoughts"
            value={body}
            onChangeText={setBody}
            placeholder="What stood out here?"
            multiline
            autoFocus
            style={{ minHeight: 88, textAlignVertical: 'top', paddingTop: space.md }}
          />
          <View style={{ alignItems: 'center', gap: space.sm }}>
            <Caption>How does it rate?</Caption>
            <Stars value={rating} onChange={setRating} />
          </View>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button
              title="Cancel"
              variant="ghost"
              size="md"
              onPress={() => {
                setComposing(false);
                setBody('');
                setRating(null);
              }}
              style={{ flex: 1 }}
            />
            <Button
              title="Save note"
              size="md"
              onPress={addNote}
              busy={busy}
              disabled={!body.trim()}
              style={{ flex: 2 }}
            />
          </View>
        </View>
      ) : null}

      {/* Actions ------------------------------------------------------ */}
      {(canAddNotes || canAddPhotos) && !composing ? (
        <View
          style={{
            flexDirection: 'row',
            borderTopWidth: 1,
            borderTopColor: t.border,
          }}
        >
          {canAddNotes ? (
            <Action
              icon={mine ? 'create-outline' : 'chatbubble-outline'}
              label={mine ? 'Add another note' : 'Add a note'}
              onPress={() => setComposing(true)}
            />
          ) : null}
          {canAddNotes && canAddPhotos ? (
            <View style={{ width: 1, backgroundColor: t.border }} />
          ) : null}
          {canAddPhotos ? (
            <Action
              icon="camera-outline"
              label={uploading ? 'Uploading…' : 'Photo'}
              onPress={choosePhotoSource}
              disabled={uploading}
            />
          ) : null}
        </View>
      ) : null}

      {error ? (
        <View style={{ padding: space.lg, paddingTop: 0 }}>
          <ErrorText>{error}</ErrorText>
        </View>
      ) : null}
    </Card>
  );
}

function Action({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.96}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.sm,
        paddingVertical: space.lg,
      }}
    >
      <Ionicons name={icon} size={19} color={t.primary} />
      <BodyStrong style={{ color: t.primary, fontSize: 15 }}>{label}</BodyStrong>
    </Touchable>
  );
}
