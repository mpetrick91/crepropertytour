import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Badge,
  Body,
  Card,
  Heading,
  InternalNote,
  Muted,
  SectionLabel,
  Stars,
  StopNumber,
  Title,
} from '@/components/ui';
import { cityState, formatTourDate } from '@/lib/format';
import { signedPhotoUrls } from '@/lib/photos';
import { supabase } from '@/lib/supabase';
import { radius, spacing, useTheme } from '@/lib/theme';
import type { Property, Tour } from '@/lib/types';

type StopRow = {
  id: string;
  position: number;
  broker_notes: string | null;
  properties: Pick<Property, 'name' | 'address_line1' | 'city' | 'state'> | null;
};

type NoteRow = {
  id: string;
  stop_id: string;
  body: string;
  rating: number | null;
  tour_participants: { display_name: string; role: string; company: string | null } | null;
};

type PhotoRow = { id: string; stop_id: string; storage_path: string; caption: string | null };

/** Everything the client said, gathered by stop, for writing the follow-up. */
export default function RecapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const t = useTheme();

  const [tour, setTour] = useState<Tour | null>(null);
  const [stops, setStops] = useState<StopRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;

    const [{ data: tourRow }, { data: stopRows }, { data: noteRows }, { data: photoRows }] =
      await Promise.all([
        supabase.from('tours').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('tour_stops')
          .select('id, position, broker_notes, properties(name, address_line1, city, state)')
          .eq('tour_id', id)
          .order('position'),
        supabase
          .from('stop_notes')
          .select('id, stop_id, body, rating, tour_participants(display_name, role, company)')
          .eq('tour_id', id)
          .order('created_at'),
        supabase
          .from('stop_photos')
          .select('id, stop_id, storage_path, caption')
          .eq('tour_id', id)
          .order('created_at'),
      ]);

    setTour(tourRow ?? null);
    setStops((stopRows as StopRow[] | null) ?? []);
    setNotes((noteRows as NoteRow[] | null) ?? []);
    setPhotos((photoRows as PhotoRow[] | null) ?? []);

    setUrls(await signedPhotoUrls((photoRows ?? []).map((p) => p.storage_path)));
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={t.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{
        padding: spacing.lg,
        paddingBottom: insets.bottom + spacing.xxl,
        gap: spacing.lg,
      }}
    >
      <View style={{ gap: spacing.xs }}>
        <Title>{tour?.title}</Title>
        <Muted>
          {[formatTourDate(tour?.tour_date), tour?.market].filter(Boolean).join(' · ')}
        </Muted>
        <Muted>
          {notes.length} note{notes.length === 1 ? '' : 's'} and {photos.length} photo
          {photos.length === 1 ? '' : 's'} from the walkthrough.
        </Muted>
      </View>

      {stops.map((stop, index) => {
        const stopNotes = notes.filter((n) => n.stop_id === stop.id);
        const stopPhotos = photos.filter((p) => p.stop_id === stop.id);
        const rated = stopNotes.filter((n) => n.rating);
        const average = rated.length
          ? rated.reduce((sum, n) => sum + (n.rating ?? 0), 0) / rated.length
          : null;

        return (
          <View key={stop.id} style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
              <StopNumber n={index + 1} />
              <View style={{ flex: 1, gap: 2 }}>
                <Heading>{stop.properties?.name ?? stop.properties?.address_line1}</Heading>
                <Muted>
                  {[
                    stop.properties?.address_line1,
                    cityState(stop.properties?.city, stop.properties?.state),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Muted>
              </View>
              {average ? <Badge>{average.toFixed(1)} avg</Badge> : null}
            </View>

            {stop.broker_notes ? <InternalNote>{stop.broker_notes}</InternalNote> : null}

            {stopNotes.length ? (
              stopNotes.map((note) => (
                <Card key={note.id} style={{ gap: spacing.xs }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Body style={{ fontWeight: '600' }}>
                      {note.tour_participants?.display_name ?? 'Someone'}
                      {note.tour_participants?.company
                        ? ` · ${note.tour_participants.company}`
                        : ''}
                    </Body>
                    {note.rating ? <Stars value={note.rating} size={14} /> : null}
                  </View>
                  <Body>{note.body}</Body>
                </Card>
              ))
            ) : (
              <Muted>No client notes on this stop.</Muted>
            )}

            {stopPhotos.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {stopPhotos.map((photo) => {
                    const uri = urls.get(photo.storage_path);
                    return uri ? (
                      <Image
                        key={photo.id}
                        source={{ uri }}
                        style={{ width: 140, height: 140, borderRadius: radius.sm }}
                        contentFit="cover"
                        transition={150}
                        accessibilityLabel={photo.caption ?? 'Tour photo'}
                      />
                    ) : (
                      <View
                        key={photo.id}
                        style={{
                          width: 140,
                          height: 140,
                          borderRadius: radius.sm,
                          backgroundColor: t.surface,
                        }}
                      />
                    );
                  })}
                </View>
              </ScrollView>
            ) : null}
          </View>
        );
      })}

      {!stops.length ? <SectionLabel>This tour has no stops yet.</SectionLabel> : null}
    </ScrollView>
  );
}
