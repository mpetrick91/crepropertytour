import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, View } from 'react-native';

import { ScreenBody, ScreenHeader } from '@/components/screen';
import {
  Appear,
  Body,
  BodyStrong,
  Button,
  Caption,
  Card,
  Empty,
  ErrorText,
  Heading,
  IconButton,
  InternalNote,
  Label,
  Muted,
  Pill,
  SectionHeader,
  StopNumber,
  Title,
  Touchable,
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
  const subtitle = [formatTourDate(tour.tour_date), tour.market].filter(Boolean).join(' · ');

  return (
    <>
      <ScreenHeader
        title={tour.title}
        subtitle={subtitle || 'No date set'}
        back
        right={
          <Touchable
            onPress={() => router.push(`/tours/${tour.id}/recap`)}
            accessibilityLabel="Client feedback recap"
            haptic="medium"
            scaleTo={0.88}
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.pill,
              backgroundColor: 'rgba(255,255,255,0.18)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={21} color="#fff" />
          </Touchable>
        }
      />

      <ScreenBody>
        <ErrorText>{error}</ErrorText>

        {tour.requirement_summary ? (
          <Appear>
            <Card style={{ gap: space.xs }}>
              <Label>What they need</Label>
              <Body>{tour.requirement_summary}</Body>
            </Card>
          </Appear>
        ) : null}

        {tour.notes ? <InternalNote>{tour.notes}</InternalNote> : null}

        {/* ── Itinerary ────────────────────────────────────────────────── */}

        <SectionHeader title={stops.length ? `Itinerary · ${stops.length} stops` : 'Itinerary'} />

        {!stops.length ? (
          <Empty icon="add-circle-outline" title="No stops yet">
            Pick buildings from your library below to build the route.
          </Empty>
        ) : (
          stops.map((stop, index) => {
            const property = stop.properties;
            const label = property?.name ?? property?.address_line1 ?? 'Property';
            const sf = formatSf(property?.available_sf);
            const rate = formatRate(property?.rent_rate, property?.rent_type);

            return (
              <Appear key={stop.id} index={index}>
                <Card style={{ gap: space.md }}>
                  <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
                    <StopNumber n={index + 1} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Heading numberOfLines={2}>{label}</Heading>
                      <Muted numberOfLines={1}>
                        {[property?.address_line1, cityState(property?.city, property?.state)]
                          .filter(Boolean)
                          .join(' · ')}
                      </Muted>
                    </View>
                  </View>

                  {sf || rate ? (
                    <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                      {sf ? <Pill icon="resize-outline">{sf}</Pill> : null}
                      {rate ? (
                        <Pill icon="pricetag-outline" bg={t.accentSoft} fg={t.accentInk}>
                          {rate}
                        </Pill>
                      ) : null}
                    </View>
                  ) : null}

                  {stop.broker_notes ? <InternalNote>{stop.broker_notes}</InternalNote> : null}

                  {/* Reordering is the common action and removal is the rare
                      one, so the arrows are plain controls and Remove is the
                      only thing wearing a warning colour. */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space.sm,
                      paddingTop: space.sm,
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: t.border,
                    }}
                  >
                    <IconButton
                      icon="arrow-up"
                      label={`Move ${label} earlier`}
                      onPress={() => moveStop(stop.id, -1)}
                      disabled={index === 0 || busy}
                    />
                    <IconButton
                      icon="arrow-down"
                      label={`Move ${label} later`}
                      onPress={() => moveStop(stop.id, 1)}
                      disabled={index === stops.length - 1 || busy}
                    />
                    <View style={{ flex: 1 }} />
                    <IconButton
                      icon="trash-outline"
                      label={`Remove ${label}`}
                      tone="danger"
                      onPress={() => confirmRemoveStop(stop.id, label)}
                      disabled={busy}
                    />
                  </View>
                </Card>
              </Appear>
            );
          })
        )}

        {/* ── Library ──────────────────────────────────────────────────── */}

        <SectionHeader
          title="Add a building"
          action="New building"
          onAction={() => router.push('/properties/new')}
        />

        {!available.length ? (
          <Muted>Every building in your library is already on this tour.</Muted>
        ) : (
          available.slice(0, 8).map((property) => (
            <Touchable
              key={property.id}
              onPress={() => addStop(property.id)}
              disabled={busy}
              haptic="medium"
              scaleTo={0.98}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.md,
                padding: space.lg,
                borderRadius: radius.lg,
                backgroundColor: t.surface,
                borderWidth: 1,
                borderColor: t.border,
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <BodyStrong numberOfLines={1}>
                  {property.name ?? property.address_line1}
                </BodyStrong>
                <Caption numberOfLines={1}>
                  {[property.address_line1, cityState(property.city, property.state)]
                    .filter(Boolean)
                    .join(' · ')}
                </Caption>
              </View>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: radius.pill,
                  backgroundColor: t.primarySoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="add" size={20} color={t.primary} />
              </View>
            </Touchable>
          ))
        )}

        {/* ── Client links ─────────────────────────────────────────────── */}

        <SectionHeader title="Client link" />

        {!activeShares.length ? (
          <Card style={{ gap: space.md, alignItems: 'flex-start' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Ionicons name="link" size={18} color={t.primary} />
              <BodyStrong>No link yet</BodyStrong>
            </View>
            <Muted>
              Your client taps the link, types their name, and they&apos;re on the tour. No
              account, no app store, nothing to install.
            </Muted>
            <Button title="Create client link" icon="add" onPress={createShare} busy={busy} />
          </Card>
        ) : (
          activeShares.map((share) => (
            <Card key={share.id} style={{ gap: space.md }}>
              <View
                style={{
                  backgroundColor: t.surfaceSunken,
                  borderRadius: radius.md,
                  padding: space.md,
                }}
              >
                <Body style={{ fontSize: 13 }} selectable numberOfLines={2}>
                  {shareUrl(share)}
                </Body>
              </View>

              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Button
                  title="Send"
                  icon="paper-plane-outline"
                  onPress={() => sendShare(share)}
                  style={{ flex: 2 }}
                />
                <Button
                  title="Copy"
                  icon="copy-outline"
                  variant="secondary"
                  onPress={() => copyShare(share)}
                  style={{ flex: 1 }}
                />
              </View>

              <Pressable onPress={() => confirmRevoke(share)} hitSlop={10} accessibilityRole="button">
                <Caption style={{ textAlign: 'center', textDecorationLine: 'underline' }}>
                  Turn off this link
                </Caption>
              </Pressable>
            </Card>
          ))
        )}

        {activeShares.length ? (
          <Button
            title="Create another link"
            variant="ghost"
            onPress={createShare}
            busy={busy}
          />
        ) : null}
      </ScreenBody>
    </>
  );
}
