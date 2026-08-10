import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, View } from 'react-native';

import {
  Body,
  Button,
  Card,
  ErrorText,
  Field,
  Heading,
  Muted,
  Stars,
  StopNumber,
} from '@/components/ui';
import { cityState, formatRate, formatSf, humanError } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { radius, spacing, TAP_TARGET, useTheme } from '@/lib/theme';
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
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = property?.name ?? property?.address_line1 ?? 'Property';
  const location = cityState(property?.city, property?.state);
  const address = [property?.address_line1, location].filter(Boolean).join(', ');

  const facts = [
    formatSf(property?.available_sf),
    formatRate(property?.rent_rate, property?.rent_type),
    property?.clear_height_ft ? `${property.clear_height_ft} ft clear` : null,
    property?.dock_doors ? `${property.dock_doors} docks` : null,
  ].filter(Boolean) as string[];

  function openDirections() {
    if (!address) return;
    const query = encodeURIComponent(address);
    // Apple Maps on iOS, Google Maps elsewhere -- whichever the phone expects.
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

    setBody('');
    setRating(null);
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
          const { error: deleteError } = await supabase
            .from('stop_notes')
            .delete()
            .eq('id', noteId);
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
        : await ImagePicker.launchImageLibraryAsync({
            quality: 0.7,
            mediaTypes: ['images'],
          });

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
      const contentType = asset.mimeType ?? 'image/jpeg';
      // The tour id has to lead the key -- that is what the storage policies
      // parse to decide whether this person may write here.
      const path = tourPhotoPath(tourId, stopId, filename);

      const { error: uploadError } = await supabase.storage
        .from(TOUR_PHOTOS_BUCKET)
        .upload(path, bytes, { contentType, upsert: false });

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

      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? humanError(caught.message) : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  function choosePhotoSource() {
    Alert.alert('Add a photo', undefined, [
      { text: 'Take photo', onPress: () => pickPhoto('camera') },
      { text: 'Choose from library', onPress: () => pickPhoto('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
        <StopNumber n={index + 1} />
        <View style={{ flex: 1, gap: 2 }}>
          <Heading>{title}</Heading>
          {address ? (
            <Pressable
              onPress={openDirections}
              accessibilityRole="link"
              accessibilityHint="Opens directions in maps"
              hitSlop={6}
            >
              <Muted style={{ textDecorationLine: 'underline' }}>{address}</Muted>
            </Pressable>
          ) : null}
          {facts.length ? (
            <Muted style={{ fontVariant: ['tabular-nums'] }}>{facts.join(' · ')}</Muted>
          ) : null}
          {property?.description ? (
            <Body style={{ marginTop: spacing.xs }}>{property.description}</Body>
          ) : null}
        </View>
      </View>

      {photos.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {photos.map((photo) =>
              photo.url ? (
                <Image
                  key={photo.id}
                  source={{ uri: photo.url }}
                  style={{ width: 108, height: 108, borderRadius: radius.sm }}
                  contentFit="cover"
                  transition={150}
                  accessibilityLabel={photo.caption ?? 'Tour photo'}
                />
              ) : (
                <View
                  key={photo.id}
                  style={{
                    width: 108,
                    height: 108,
                    borderRadius: radius.sm,
                    backgroundColor: t.surface,
                  }}
                />
              ),
            )}
          </View>
        </ScrollView>
      ) : null}

      {notes.map((note) => (
        <View
          key={note.id}
          style={{ backgroundColor: t.surface, borderRadius: radius.sm, padding: spacing.md, gap: 4 }}
        >
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Body style={{ fontWeight: '600' }}>{note.isMine ? 'You' : note.authorName}</Body>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              {note.rating ? <Stars value={note.rating} size={14} /> : null}
              {note.isMine ? (
                <Pressable
                  onPress={() => confirmDeleteNote(note.id)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Delete your note"
                >
                  <Muted style={{ textDecorationLine: 'underline' }}>Delete</Muted>
                </Pressable>
              ) : null}
            </View>
          </View>
          <Body>{note.body}</Body>
        </View>
      ))}

      {canAddNotes ? (
        <View style={{ gap: spacing.md }}>
          <Field
            label="Your notes"
            value={body}
            onChangeText={setBody}
            placeholder="What stood out here?"
            multiline
            numberOfLines={3}
            style={{ minHeight: TAP_TARGET * 1.8, textAlignVertical: 'top' }}
          />
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Stars value={rating} onChange={setRating} />
            <Button title="Add note" onPress={addNote} busy={busy} disabled={!body.trim()} />
          </View>
        </View>
      ) : null}

      {canAddPhotos ? (
        <Button
          title={uploading ? 'Uploading…' : 'Add photo'}
          variant="secondary"
          onPress={choosePhotoSource}
          busy={uploading}
        />
      ) : null}

      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

