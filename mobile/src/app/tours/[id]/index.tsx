import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, Switch, Text, View } from 'react-native';

import { ScreenBody, ScreenHeader } from '@/components/screen';
import { StopTimeSheet } from '@/components/time-picker';
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
  haptic,
  SectionHeader,
  StopNumber,
  Title,
  Touchable,
} from '@/components/ui';
import { formatDistance } from '@/lib/distance';
import { cityState, formatRate, formatSf, formatTourDate, humanError } from '@/lib/format';
import { buildSchedule, formatWindow } from '@/lib/schedule';
import { useLiveTour } from '@/lib/use-live-tour';
import { siteUrl, supabase } from '@/lib/supabase';
import { radius, space, useTheme } from '@/lib/theme';
import type { Property, Tour, TourShare } from '@/lib/types';

type StopRow = {
  id: string;
  position: number;
  broker_notes: string | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  property_id: string;
  properties: Pick<
    Property,
    | 'id'
    | 'name'
    | 'address_line1'
    | 'city'
    | 'state'
    | 'latitude'
    | 'longitude'
    | 'available_sf'
    | 'rent_rate'
    | 'rent_type'
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
  const [following, setFollowing] = useState(false);
  const [editingStop, setEditingStop] = useState<StopRow | null>(null);

  const load = useCallback(async () => {
    if (!id) return;

    const [{ data: tourRow }, { data: stopRows }, { data: properties }, { data: shareRows }] =
      await Promise.all([
        supabase.from('tours').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('tour_stops')
          .select(
            'id, position, broker_notes, scheduled_at, duration_minutes, property_id, ' +
              'properties(id, name, address_line1, city, state, latitude, longitude, available_sf, rent_rate, rent_type)',
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

  /**
   * A fixed arrival time is stored on the stop; every later stop then counts
   * from it rather than from the tour's start.
   */
  async function saveStopTime(
    stop: StopRow,
    time: { hours: number; minutes: number },
    duration: number,
  ) {
    const day = tour?.tour_date ?? new Date().toISOString().slice(0, 10);
    const when = new Date(`${day}T00:00:00`);
    when.setHours(time.hours, time.minutes, 0, 0);

    setEditingStop(null);
    await run(async () =>
      supabase
        .from('tour_stops')
        .update({ scheduled_at: when.toISOString(), duration_minutes: duration })
        .eq('id', stop.id),
    );
  }

  async function clearStopTime(stop: StopRow) {
    setEditingStop(null);
    await run(async () =>
      supabase.from('tour_stops').update({ scheduled_at: null }).eq('id', stop.id),
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

  // Every hook has to run on every render, so these sit above the early
  // returns for loading and not-found rather than beside the markup that uses
  // them. Both cope with `tour` being null while it loads.
  const schedule = buildSchedule(stops, tour?.tour_date ?? null, tour?.start_time ?? null);

  // Only buildings with coordinates can take part; the rest stay in the list
  // and are simply never matched against.
  const locatable = useMemo(
    () =>
      stops
        .filter((stop) => stop.properties?.latitude != null && stop.properties?.longitude != null)
        .map((stop) => ({
          id: stop.id,
          latitude: stop.properties!.latitude as number,
          longitude: stop.properties!.longitude as number,
        })),
    [stops],
  );

  const live = useLiveTour(locatable, following);

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

        {stops.length ? (
          <FollowBar
            following={following}
            onToggle={setFollowing}
            live={live}
            locatable={locatable.length}
            total={stops.length}
            stopLabel={(stopId: string) => {
              const stop = stops.find((entry) => entry.id === stopId);
              return stop?.properties?.name ?? stop?.properties?.address_line1 ?? 'a stop';
            }}
          />
        ) : null}

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
            const slot = schedule.get(stop.id);
            const here = live.currentStopId === stop.id;

            return (
              <Appear key={stop.id} index={index}>
                <Card
                  style={{
                    gap: space.md,
                    // The stop you are standing at is the one worth finding
                    // without reading, so it gets an edge rather than a label.
                    borderWidth: here ? 2 : undefined,
                    borderColor: here ? t.accent : undefined,
                  }}
                >
                  <StopTimeBar
                    arrival={slot?.arrival ?? null}
                    minutes={slot?.minutes ?? 0}
                    pinned={slot?.pinned ?? false}
                    here={here}
                    onPress={() => setEditingStop(stop)}
                  />

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

      {editingStop ? (
        <StopTimeSheet
          open
          label={
            editingStop.properties?.name ?? editingStop.properties?.address_line1 ?? 'This stop'
          }
          arrival={schedule.get(editingStop.id)?.arrival ?? null}
          minutes={schedule.get(editingStop.id)?.minutes ?? 45}
          pinned={schedule.get(editingStop.id)?.pinned ?? false}
          onClose={() => setEditingStop(null)}
          onSave={(time, duration) => saveStopTime(editingStop, time, duration)}
          onClear={() => clearStopTime(editingStop)}
        />
      ) : null}
    </>
  );
}

/**
 * The time a stop happens, along the top of its card.
 *
 * Given the whole width because on a tour this is the second thing anyone
 * looks at, after which building it is. Tapping it sets a fixed time; a pinned
 * stop says so, because the difference between "we plan to be here at 10:30"
 * and "the landlord is expecting us at 10:30" matters when the day slips.
 */
function StopTimeBar({
  arrival,
  minutes,
  pinned,
  here,
  onPress,
}: {
  arrival: Date | null;
  minutes: number;
  pinned: boolean;
  here: boolean;
  onPress: () => void;
}) {
  const t = useTheme();

  return (
    <Touchable
      onPress={onPress}
      scaleTo={0.98}
      accessibilityLabel={arrival ? `Change the time for this stop` : 'Set a time for this stop'}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingBottom: space.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: t.border,
      }}
    >
      <Ionicons
        name={here ? 'navigate-circle' : pinned ? 'lock-closed' : 'time-outline'}
        size={16}
        color={here ? t.accentInk : t.textMuted}
      />

      <Text
        style={{
          flex: 1,
          fontSize: 15,
          fontWeight: '800',
          letterSpacing: -0.2,
          color: here ? t.accentInk : t.text,
          fontVariant: ['tabular-nums'],
        }}
      >
        {arrival ? formatWindow(arrival, minutes) : `${minutes} min · no time yet`}
      </Text>

      {here ? (
        <Pill bg={t.accentSoft} fg={t.accentInk}>
          You&apos;re here
        </Pill>
      ) : (
        <Ionicons name="chevron-forward" size={15} color={t.textFaint} />
      )}
    </Touchable>
  );
}

/**
 * The switch that makes the tour follow the broker, and the running commentary
 * on what it can see.
 *
 * States it plainly rather than pretending: it only works while this screen is
 * open, and only for buildings that have coordinates. A broker who knows what
 * a feature does not do will trust the part that works.
 */
function FollowBar({
  following,
  onToggle,
  live,
  locatable,
  total,
  stopLabel,
}: {
  following: boolean;
  onToggle: (value: boolean) => void;
  live: ReturnType<typeof useLiveTour>;
  locatable: number;
  total: number;
  stopLabel: (stopId: string) => string;
}) {
  const t = useTheme();

  const status = (() => {
    if (!following) {
      return locatable === 0
        ? 'No building on this tour has a location yet.'
        : locatable < total
          ? `Follows ${locatable} of ${total} buildings — the rest have no location.`
          : 'Switches to each building as you arrive.';
    }
    if (live.error) return live.error;
    if (live.locating) return 'Finding you…';
    if (live.currentStopId) return `At ${stopLabel(live.currentStopId)}.`;
    if (live.nearestStopId && live.metres != null) {
      return `${formatDistance(live.metres)} from ${stopLabel(live.nearestStopId)}.`;
    }
    return 'Watching for the next building.';
  })();

  const disabled = locatable === 0;

  return (
    <Appear>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          padding: space.lg,
          borderRadius: radius.lg,
          backgroundColor: following ? t.accentSoft : t.surface,
          borderWidth: 1,
          borderColor: following ? t.accent : t.border,
        }}
      >
        <Ionicons
          name={following ? 'navigate-circle' : 'navigate-outline'}
          size={22}
          color={following ? t.accentInk : t.textMuted}
        />

        <View style={{ flex: 1, gap: 1 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: '700',
              color: following ? t.accentInk : t.text,
            }}
          >
            Follow me
          </Text>
          <Caption style={{ color: following ? t.accentInk : t.textFaint }}>{status}</Caption>
        </View>

        <Switch
          value={following}
          onValueChange={(next) => {
            haptic('medium');
            onToggle(next);
          }}
          disabled={disabled}
          trackColor={{ true: t.accent, false: t.borderStrong }}
          thumbColor="#fff"
        />
      </View>
    </Appear>
  );
}
