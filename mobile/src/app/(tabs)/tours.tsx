import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';

import { Cityscape } from '@/components/cityscape';
import { ScreenBody, ScreenHeader } from '@/components/screen';
import {
  Appear,
  Button,
  Caption,
  CardButton,
  Empty,
  Heading,
  Muted,
  Pill,
  SectionHeader,
  Segmented,
  Stat,
  StatRow,
  Touchable,
} from '@/components/ui';
import { formatTourDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { elevation, radius, space, statusStyle, useIsDark, useTheme } from '@/lib/theme';

type Stop = { id: string; position: number; properties: { name: string | null; address_line1: string } | null };

type TourRow = {
  id: string;
  title: string;
  status: string;
  tour_date: string | null;
  market: string | null;
  clients: { name: string; company: string | null } | { name: string; company: string | null }[] | null;
  tour_stops: Stop[];
  stop_notes: { count: number }[];
};

/** Days until a tour, as something to say rather than a date to work out. */
function countdown(date: string | null): { text: string; urgent: boolean } | null {
  if (!date) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${date}T00:00:00`);
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  if (days === 0) return { text: 'Today', urgent: true };
  if (days === 1) return { text: 'Tomorrow', urgent: true };
  if (days > 1 && days <= 14) return { text: `In ${days} days`, urgent: days <= 3 };
  if (days < 0) return { text: `${Math.abs(days)} days ago`, urgent: false };
  return null;
}

/** "Aug 24" -- the full date does not fit beside two other numbers. */
function shortDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function clientOf(tour: TourRow) {
  return Array.isArray(tour.clients) ? tour.clients[0] : tour.clients;
}

function buildingsOf(tour: TourRow) {
  return (tour.tour_stops ?? [])
    .filter((stop) => stop.properties)
    .map((stop) => ({ name: stop.properties!.name, address: stop.properties!.address_line1 }));
}

export default function ToursScreen() {
  const router = useRouter();
  const t = useTheme();
  const isDark = useIsDark();

  const [tours, setTours] = useState<TourRow[]>([]);
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [library, setLibrary] = useState<{ id: string; name: string | null; address_line1: string }[]>([]);

  const load = useCallback(async () => {
    const [{ data }, { data: user }, { data: properties }] = await Promise.all([
      supabase
        .from('tours')
        .select(
          'id, title, status, tour_date, market, clients(name, company), ' +
            'tour_stops(id, position, properties(name, address_line1)), stop_notes(count)',
        )
        .order('tour_date', { ascending: false, nullsFirst: false }),
      supabase.auth.getUser(),
      supabase.from('properties').select('id, name, address_line1').order('created_at', { ascending: false }),
    ]);

    setLibrary(properties ?? []);

    setTours((data as TourRow[] | null) ?? []);

    if (user.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.user.id)
        .maybeSingle();
      setName(profile?.full_name?.split(' ')[0] ?? null);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const today = new Date().toISOString().slice(0, 10);
  const live = tours.filter((tour) => tour.status !== 'archived');
  const upcoming = live.filter((tour) => !tour.tour_date || tour.tour_date >= today);
  const past = live.filter((tour) => tour.tour_date && tour.tour_date < today);

  // The soonest tour, not the most recent -- ordering is newest-first, so the
  // next one up is the last of the upcoming set.
  const next = [...upcoming].reverse().find((tour) => tour.tour_date) ?? upcoming[0];
  const rest = (tab === 'upcoming' ? upcoming : past).filter((tour) => tour.id !== next?.id);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <ScreenHeader
        title={name ? `${greeting}, ${name}` : greeting}
        subtitle={live.length ? `${live.length} tour${live.length === 1 ? '' : 's'} on your board` : null}
        right={
          <Touchable
            onPress={() => router.push('/tours/new')}
            accessibilityLabel="New tour"
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
            <Ionicons name="add" size={26} color="#fff" />
          </Touchable>
        }
      />

      <ScreenBody
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={t.textMuted}
          />
        }
      >
        {loading ? (
          <ActivityIndicator color={t.primary} style={{ marginTop: space.xxl }} />
        ) : !live.length ? (
          <Empty
            icon="map-outline"
            title="No tours yet"
            action={
              <Button title="Create your first tour" icon="add" onPress={() => router.push('/tours/new')} />
            }
          >
            Add a few buildings, then build a tour and send your client one link.
          </Empty>
        ) : (
          <>
            {next ? <NextTourCard tour={next} onPress={() => router.push(`/tours/${next.id}`)} /> : null}

            {past.length ? (
              <Segmented
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'upcoming', label: 'Upcoming', count: upcoming.length },
                  { value: 'past', label: 'Past', count: past.length },
                ]}
              />
            ) : null}

            {rest.length ? (
              <>
                <SectionHeader title={tab === 'upcoming' ? 'Also coming up' : 'Completed'} />
                {rest.map((tour, index) => {
                  const client = clientOf(tour);
                  const buildings = buildingsOf(tour);
                  const notes = tour.stop_notes?.[0]?.count ?? 0;
                  const status = statusStyle(tour.status, t);
                  const when = countdown(tour.tour_date);

                  return (
                    <Appear key={tour.id} index={index}>
                      <CardButton onPress={() => router.push(`/tours/${tour.id}`)}>
                        <View style={{ gap: space.md }}>
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
                            <View style={{ flex: 1, gap: 3 }}>
                              <Heading numberOfLines={2}>{tour.title}</Heading>
                              {client ? <Muted>{client.company ?? client.name}</Muted> : null}
                            </View>
                            <Pill bg={status.bg} fg={status.fg}>
                              {status.label}
                            </Pill>
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
                            {tour.tour_date ? (
                              <Caption style={{ color: when?.urgent ? t.accentInk : t.textFaint }}>
                                {when?.text ?? formatTourDate(tour.tour_date)}
                              </Caption>
                            ) : null}
                            {tour.market ? <Caption>{tour.market}</Caption> : null}
                          </View>

                          <StatRow>
                            <Stat value={buildings.length} label="Stops" icon="business-outline" />
                            <Stat
                              value={notes}
                              label="Notes"
                              icon="chatbubble-ellipses-outline"
                              tone={notes > 0 ? 'accent' : 'default'}
                            />
                            <Stat value={tour.market ?? '—'} label="Market" />
                          </StatRow>
                        </View>
                      </CardButton>
                    </Appear>
                  );
                })}
              </>
            ) : (
              <Muted style={{ textAlign: 'center', paddingVertical: space.xl }}>
                {tab === 'past' ? 'No past tours yet.' : 'Nothing else on the calendar.'}
              </Muted>
            )}

            {library.length ? (
              <Appear index={rest.length}>
                <View style={{ gap: space.md }}>
                  <SectionHeader
                    title="Your buildings"
                    action="See all"
                    onAction={() => router.push('/properties')}
                  />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    // Negative margin lets the row bleed to the screen edge, so
                    // it reads as scrollable rather than as a boxed-in list.
                    style={{ marginHorizontal: -space.lg }}
                    contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.md }}
                  >
                    {library.slice(0, 10).map((property) => (
                      <Touchable
                        key={property.id}
                        onPress={() => router.push(`/properties/${property.id}`)}
                        scaleTo={0.96}
                        style={{
                          width: 190,
                          gap: 3,
                          padding: space.lg,
                          borderRadius: radius.lg,
                          backgroundColor: t.surface,
                          borderWidth: 1,
                          borderColor: t.border,
                        }}
                      >
                        <Text
                          numberOfLines={1}
                          style={{ fontSize: 15, fontWeight: '700', color: t.text }}
                        >
                          {property.name ?? property.address_line1}
                        </Text>
                        <Caption numberOfLines={1}>{property.address_line1}</Caption>
                      </Touchable>
                    ))}
                  </ScrollView>
                </View>
              </Appear>
            ) : null}

            <Appear index={rest.length + 1}>
              <Touchable
                onPress={() => router.push('/tours/new')}
                haptic="medium"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: space.sm,
                  paddingVertical: space.lg,
                  borderRadius: radius.lg,
                  borderWidth: 1.5,
                  borderStyle: 'dashed',
                  borderColor: t.borderStrong,
                }}
              >
                <Ionicons name="add-circle-outline" size={19} color={t.primary} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: t.primary }}>New tour</Text>
              </Touchable>
            </Appear>
          </>
        )}
      </ScreenBody>
    </>
  );
}

/**
 * The tour you are actually about to walk, given the whole top of the screen.
 *
 * A broker opens this app on a sidewalk, and nine times in ten they want the
 * same thing: the tour that is happening now or next. Making it a full-width
 * coloured card with its own action turns the home screen from a list you have
 * to search into an answer.
 */
function NextTourCard({ tour, onPress }: { tour: TourRow; onPress: () => void }) {
  const t = useTheme();
  const isDark = useIsDark();
  const client = clientOf(tour);
  const stops = (tour.tour_stops ?? []).length;
  const when = countdown(tour.tour_date);
  const touring = tour.status === 'in_progress';

  return (
    <Appear>
      <Touchable onPress={onPress} scaleTo={0.985} style={elevation(3, isDark)}>
        <View style={{ borderRadius: radius.xl, overflow: 'hidden', backgroundColor: t.primary }}>
          <Cityscape market={tour.market} height={168} tint={touring ? 'dusk' : 'night'} />

          {/* Above the scrim and clear of the skyline, so the scene reads as a
              band across the top rather than a backdrop with a label on it. */}
          <View
            style={{
              position: 'absolute',
              top: space.lg,
              left: space.xl,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              backgroundColor: 'rgba(6,13,28,0.55)',
              paddingHorizontal: space.md,
              paddingVertical: 6,
              borderRadius: radius.pill,
            }}
          >
            <Ionicons name={touring ? 'radio' : 'calendar'} size={12} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.3 }}>
              {touring ? 'TOURING NOW' : when ? when.text.toUpperCase() : 'NEXT UP'}
            </Text>
          </View>

          {/* The scene is at its busiest exactly where the title sits, so the
              text gets its own scrim rather than relying on the art staying
              dark in the right places. */}
          <LinearGradient
            colors={['transparent', 'rgba(6,13,28,0.55)', touring ? '#7A3B10' : '#0A2158']}
            locations={[0, 0.42, 0.78]}
            style={{ paddingTop: 108, paddingHorizontal: space.xl, paddingBottom: space.xl, gap: space.md }}
          >
            <View style={{ gap: 3 }}>
              <Text
                numberOfLines={2}
                style={{ color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.6, lineHeight: 31 }}
              >
                {tour.title}
              </Text>
              {client ? (
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '600' }}>
                  {client.company ?? client.name}
                </Text>
              ) : null}
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                paddingTop: space.md,
                borderTopWidth: 1,
                borderTopColor: 'rgba(255,255,255,0.22)',
              }}
            >
              <View style={{ flex: 1, gap: space.sm }}>
                <HeroFact icon="calendar-outline" text={formatTourDate(tour.tour_date) ?? 'No date yet'} />
                {tour.market ? <HeroFact icon="location-outline" text={tour.market} /> : null}
                <HeroFact
                  icon="business-outline"
                  text={`${stops} building${stops === 1 ? '' : 's'}`}
                />
              </View>

              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.pill,
                  backgroundColor: '#fff',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="arrow-forward" size={21} color={touring ? '#B4681C' : t.primary} />
              </View>
            </View>
          </LinearGradient>
        </View>
      </Touchable>
    </Appear>
  );
}

/** One line of the hero's summary: an icon and a fact, nothing to decode. */
function HeroFact({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <Ionicons name={icon} size={14} color="rgba(255,255,255,0.7)" />
      <Text style={{ color: '#fff', fontSize: 14.5, fontWeight: '600' }} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}
