import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { ScreenBody, ScreenHeader } from '@/components/screen';
import {
  Appear,
  Body,
  BodyStrong,
  Caption,
  Card,
  Empty,
  Heading,
  InternalNote,
  Label,
  Muted,
  Pill,
  Stars,
  Stat,
  StopNumber,
} from '@/components/ui';
import { cityState, formatTourDate } from '@/lib/format';
import { signedPhotoUrls } from '@/lib/photos';
import { supabase } from '@/lib/supabase';
import { radius, space, useTheme } from '@/lib/theme';
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
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }

  const rated = notes.filter((note) => note.rating);
  const overall = rated.length
    ? rated.reduce((sum, note) => sum + (note.rating ?? 0), 0) / rated.length
    : null;

  // The building the client actually liked, which is the first thing you want
  // to know when you sit down to write the follow-up.
  const best = stops
    .map((stop) => {
      const scored = notes.filter((note) => note.stop_id === stop.id && note.rating);
      if (!scored.length) return null;
      const average = scored.reduce((sum, note) => sum + (note.rating ?? 0), 0) / scored.length;
      return { stop, average };
    })
    .filter((entry): entry is { stop: StopRow; average: number } => entry !== null)
    .sort((a, b) => b.average - a.average)[0];

  return (
    <>
      <ScreenHeader
        title="Recap"
        subtitle={tour?.title ?? null}
        back
      />

      <ScreenBody>
        {/* The three numbers that say whether the tour produced anything,
            before any of the detail. */}
        <Appear>
          <Card style={{ gap: space.lg }}>
            <View style={{ flexDirection: 'row', gap: space.lg }}>
              <Stat value={stops.length} label="Stops" icon="business-outline" />
              <Stat
                value={notes.length}
                label="Notes"
                icon="chatbubble-ellipses-outline"
                tone={notes.length ? 'accent' : 'default'}
              />
              <Stat value={photos.length} label="Photos" icon="image-outline" />
            </View>

            {overall ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.sm,
                  paddingTop: space.md,
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: t.border,
                }}
              >
                {/* One star, not five: rounding 4.5 up to five filled stars
                    contradicts the number printed beside it. */}
                <Ionicons name="star" size={16} color={t.gold} />
                <BodyStrong>{overall.toFixed(1)} average</BodyStrong>
                <Muted>across {rated.length} rated note{rated.length === 1 ? '' : 's'}</Muted>
              </View>
            ) : null}
          </Card>
        </Appear>

        {best ? (
          <Appear index={1}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.md,
                backgroundColor: t.accentSoft,
                borderRadius: radius.lg,
                padding: space.lg,
              }}
            >
              <Ionicons name="trophy" size={20} color={t.accentInk} />
              <View style={{ flex: 1, gap: 1 }}>
                <Label style={{ color: t.accentInk }}>Best received</Label>
                <BodyStrong style={{ color: t.accentInk }} numberOfLines={1}>
                  {best.stop.properties?.name ?? best.stop.properties?.address_line1}
                </BodyStrong>
              </View>
              <BodyStrong style={{ color: t.accentInk }}>{best.average.toFixed(1)}</BodyStrong>
            </View>
          </Appear>
        ) : null}

        {!stops.length ? (
          <Empty icon="map-outline" title="Nothing to recap yet">
            Add buildings to this tour, then send your client the link.
          </Empty>
        ) : null}

        {stops.map((stop, index) => {
          const stopNotes = notes.filter((note) => note.stop_id === stop.id);
          const stopPhotos = photos.filter((photo) => photo.stop_id === stop.id);
          const scored = stopNotes.filter((note) => note.rating);
          const average = scored.length
            ? scored.reduce((sum, note) => sum + (note.rating ?? 0), 0) / scored.length
            : null;

          return (
            <Appear key={stop.id} index={index + 2}>
              <Card style={{ gap: space.md }}>
                <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
                  <StopNumber n={index + 1} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Heading numberOfLines={2}>
                      {stop.properties?.name ?? stop.properties?.address_line1}
                    </Heading>
                    <Muted numberOfLines={1}>
                      {[
                        stop.properties?.address_line1,
                        cityState(stop.properties?.city, stop.properties?.state),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Muted>
                  </View>
                  {average ? (
                    <Pill bg={t.accentSoft} fg={t.accentInk} icon="star">
                      {average.toFixed(1)}
                    </Pill>
                  ) : null}
                </View>

                {stop.broker_notes ? <InternalNote>{stop.broker_notes}</InternalNote> : null}

                {stopPhotos.length ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginHorizontal: -space.lg }}
                    contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.sm }}
                  >
                    {stopPhotos.map((photo) => {
                      const uri = urls.get(photo.storage_path);
                      return uri ? (
                        <Image
                          key={photo.id}
                          source={{ uri }}
                          style={{ width: 132, height: 132, borderRadius: radius.md }}
                          contentFit="cover"
                          transition={150}
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
                      );
                    })}
                  </ScrollView>
                ) : null}

                {/* Client words are the point of this screen, so they are set
                    as quotes rather than as another row of card chrome. */}
                {stopNotes.length ? (
                  stopNotes.map((note) => (
                    <View
                      key={note.id}
                      style={{
                        gap: space.xs,
                        paddingLeft: space.md,
                        borderLeftWidth: 3,
                        borderLeftColor: t.primarySoft,
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
                        <Caption numberOfLines={1} style={{ flex: 1 }}>
                          {note.tour_participants?.display_name ?? 'Someone'}
                          {note.tour_participants?.company
                            ? ` · ${note.tour_participants.company}`
                            : ''}
                        </Caption>
                        {note.rating ? <Stars value={note.rating} size={13} /> : null}
                      </View>
                      <Body>{note.body}</Body>
                    </View>
                  ))
                ) : (
                  <Muted>No client notes on this stop.</Muted>
                )}
              </Card>
            </Appear>
          );
        })}
      </ScreenBody>
    </>
  );
}
