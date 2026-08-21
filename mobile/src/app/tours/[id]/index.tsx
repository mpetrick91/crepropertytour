import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BuildingMark } from '@/components/building-mark';
import {
  Body,
  Button,
  Card,
  Empty,
  ErrorText,
  Heading,
  InternalNote,
  Muted,
  Label,
  Title,
} from '@/components/ui';
import { cityState, formatRate, formatSf, formatTourDate, humanError } from '@/lib/format';
import { siteUrl, supabase } from '@/lib/supabase';
import { radius, space, useTheme } from '@/lib/theme';
import type { Property, Tour, TourShare } from '@/lib/types';

type StopRow = {
  id: string;
  position: number;
  broker_notes: string | null;
  property_id: string;
  properties: Pick<
    Property,
    'id' | 'name' | 'address_line1' | 'city' | 'state' | 'available_sf' | 'rent_rate' | 'rent_type'
  > | null;
};

export default function TourDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTheme();

  const [tour, setTour] = useState<Tour | null>(null);
  const [stops, setStops] = useState<StopRow[]>([]);
  const [library, setLibrary] = useState<Property[]>([]);
  const [shares, setShares] = useState<TourShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;

    const [{ data: tourRow }, { data: stopRows }, { data: properties }, { data: shareRows }] =
      await Promise.all([
        supabase.from('tours').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('tour_stops')
          .select(
            'id, position, broker_notes, property_id, properties(id, name, address_line1, city, state, available_sf, rent_rate, rent_type)',
          )
          .eq('tour_id', id)
          .order('position'),
        supabase.from('properties').select('*').order('address_line1'),
        supabase
          .from('tour_shares')
          .select('*')
          .eq('tour_id', id)
          .order('created_at', { ascending: false }),
      ]);

    setTour(tourRow ?? null);
    setStops((stopRows as StopRow[] | null) ?? []);
    setLibrary(properties ?? []);
    setShares(shareRows ?? []);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function run(action: () => Promise<{ error: { message: string } | null }>) {
    setBusy(true);
    setError(null);
    const { error: actionError } = await action();
    if (actionError) setError(humanError(actionError.message));
    await load();
    setBusy(false);
  }

  async function addStop(propertyId: string) {
    if (!id) return;
    const { data: position } = await supabase.rpc('next_stop_position', { p_tour_id: id });
    await run(async () =>
      supabase
        .from('tour_stops')
        .insert({ tour_id: id, property_id: propertyId, position: position ?? 1 }),
    );
  }

  async function moveStop(stopId: string, direction: -1 | 1) {
    if (!id) return;
    const order = stops.map((s) => s.id);
    const from = order.indexOf(stopId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= order.length) return;
    [order[from], order[to]] = [order[to], order[from]];

    // One statement against the deferred unique constraint -- swapping row by
    // row would collide with whatever currently holds the target position.
    await run(async () =>
      supabase.rpc('reorder_tour_stops', { p_tour_id: id, p_stop_ids: order }),
    );
  }

  function confirmRemoveStop(stopId: string, label: string) {
    Alert.alert(`Remove ${label}?`, 'Notes and photos on this stop are removed too.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await run(async () => supabase.from('tour_stops').delete().eq('id', stopId));
          // Close the gap the removed stop left behind.
          const remaining = stops.filter((s) => s.id !== stopId).map((s) => s.id);
          if (remaining.length && id) {
            await supabase.rpc('reorder_tour_stops', { p_tour_id: id, p_stop_ids: remaining });
            await load();
          }
        },
      },
    ]);
  }

  async function createShare() {
    if (!id) return;
    await run(async () =>
      supabase.rpc('create_tour_share', {
        p_tour_id: id,
        p_label: tour?.title ? `Link for ${tour.title}` : null,
        p_allow_notes: true,
        p_allow_photos: true,
        p_expires_at: null,
      }),
    );
  }

  const shareUrl = (share: TourShare) => `${siteUrl()}/t/${share.token}`;

  async function sendShare(share: TourShare) {
    // The OS share sheet -- text, email, whatever the broker uses with clients.
    await Share.share({
      message: `${tour?.title ?? 'Property tour'}\n\n${shareUrl(share)}`,
      url: shareUrl(share),
    });
  }

  async function copyShare(share: TourShare) {
    await Clipboard.setStringAsync(shareUrl(share));
    Alert.alert('Link copied', 'Paste it into a text or email to your client.');
  }

  function confirmRevoke(share: TourShare) {
    Alert.alert(
      'Turn off this link?',
      'Nobody new can join with it. Anyone already on the tour keeps their access.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Turn off',
          style: 'destructive',
          onPress: () =>
            run(async () =>
              supabase
                .from('tour_shares')
                .update({ revoked_at: new Date().toISOString() })
                .eq('id', share.id),
            ),
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }

  if (!tour) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: space.xl }}>
        <Title>Tour not found</Title>
      </View>
    );
  }

  const onTour = new Set(stops.map((s) => s.property_id));
  const available = library.filter((p) => !onTour.has(p.id));
  const activeShares = shares.filter((s) => !s.revoked_at);

  return (
    <ScrollView
      contentContainerStyle={{
        padding: space.lg,
        paddingBottom: insets.bottom + space.xxl,
        gap: space.lg,
      }}
    >
      <View style={{ gap: space.xs }}>
        <Title>{tour.title}</Title>
        <Muted>
          {[formatTourDate(tour.tour_date), tour.market].filter(Boolean).join(' · ')}
        </Muted>
      </View>

      <Button
        title="Recap — client feedback"
        variant="secondary"
        onPress={() => router.push(`/tours/${tour.id}/recap`)}
      />

      <ErrorText>{error}</ErrorText>

      {tour.notes ? <InternalNote>{tour.notes}</InternalNote> : null}

      <Label>Itinerary</Label>

      {!stops.length ? (
        <Empty icon="add-circle-outline" title="No stops yet">
          Pick buildings from your library below to build the route.
        </Empty>
      ) : (
        stops.map((stop, index) => {
          const property = stop.properties;
          const label = property?.name ?? property?.address_line1 ?? 'Property';
          const facts = [
            formatSf(property?.available_sf),
            formatRate(property?.rent_rate, property?.rent_type),
          ].filter(Boolean);

          return (
            <Card key={stop.id} style={{ gap: space.md }}>
              <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
                <BuildingMark
                  name={property?.name}
                  address={property?.address_line1 ?? label}
                  size={46}
                  badge={index + 1}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Heading>{label}</Heading>
                  <Muted>
                    {[property?.address_line1, cityState(property?.city, property?.state)]
                      .filter(Boolean)
                      .join(' · ')}
                  </Muted>
                  {facts.length ? <Muted>{facts.join(' · ')}</Muted> : null}
                </View>
              </View>

              {stop.broker_notes ? <InternalNote>{stop.broker_notes}</InternalNote> : null}

              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Button
                  title="↑"
                  variant="secondary"
                  onPress={() => moveStop(stop.id, -1)}
                  disabled={index === 0 || busy}
                  style={{ flex: 1 }}
                />
                <Button
                  title="↓"
                  variant="secondary"
                  onPress={() => moveStop(stop.id, 1)}
                  disabled={index === stops.length - 1 || busy}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Remove"
                  variant="danger"
                  onPress={() => confirmRemoveStop(stop.id, label)}
                  disabled={busy}
                  style={{ flex: 2 }}
                />
              </View>
            </Card>
          );
        })
      )}

      <Label>Add a building</Label>
      {!available.length ? (
        <Muted>
          Every property in your library is already on this tour.{' '}
          <Body
            style={{ textDecorationLine: 'underline' }}
            onPress={() => router.push('/properties/new')}
          >
            Add another
          </Body>
        </Muted>
      ) : (
        available.slice(0, 8).map((property) => (
          <Pressable
            key={property.id}
            accessibilityRole="button"
            onPress={() => addStop(property.id)}
            disabled={busy}
            style={({ pressed }) => ({ opacity: pressed || busy ? 0.6 : 1 })}
          >
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View style={{ flex: 1 }}>
                <Body style={{ fontWeight: '600' }}>
                  {property.name ?? property.address_line1}
                </Body>
                <Muted>{cityState(property.city, property.state)}</Muted>
              </View>
              <Body style={{ color: t.primary, fontWeight: '700', fontSize: 22 }}>+</Body>
            </Card>
          </Pressable>
        ))
      )}

      <Label>Client links</Label>
      <Muted>
        Send one of these. Your client taps it, enters their name, and they&apos;re on the
        tour — no account. Turning a link off stops new people joining; anyone already on
        stays on.
      </Muted>

      {activeShares.map((share) => (
        <Card key={share.id} style={{ gap: space.md }}>
          <View
            style={{ backgroundColor: t.surface, borderRadius: radius.sm, padding: space.md }}
          >
            <Body style={{ fontSize: 13 }} selectable numberOfLines={2}>
              {shareUrl(share)}
            </Body>
          </View>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button title="Send" onPress={() => sendShare(share)} style={{ flex: 2 }} />
            <Button
              title="Copy"
              variant="secondary"
              onPress={() => copyShare(share)}
              style={{ flex: 1 }}
            />
          </View>
          <Pressable onPress={() => confirmRevoke(share)} hitSlop={10} accessibilityRole="button">
            <Muted style={{ textDecorationLine: 'underline', textAlign: 'center' }}>
              Turn off this link
            </Muted>
          </Pressable>
        </Card>
      ))}

      <Button
        title={activeShares.length ? 'Create another link' : 'Create client link'}
        variant="secondary"
        onPress={createShare}
        busy={busy}
      />
    </ScrollView>
  );
}
