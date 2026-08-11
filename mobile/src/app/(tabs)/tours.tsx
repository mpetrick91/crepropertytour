import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, View } from 'react-native';

import { ScreenBody, ScreenHeader } from '@/components/screen';
import {
  BodyStrong,
  Button,
  CardButton,
  Caption,
  Empty,
  Heading,
  Label,
  Muted,
  Pill,
  Progress,
  Touchable,
} from '@/components/ui';
import { formatTourDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { radius, space, statusStyle, useTheme } from '@/lib/theme';

type TourRow = {
  id: string;
  title: string;
  status: string;
  tour_date: string | null;
  market: string | null;
  clients: { name: string; company: string | null } | { name: string; company: string | null }[] | null;
  tour_stops: { count: number }[];
  stop_notes: { count: number }[];
};

export default function ToursScreen() {
  const router = useRouter();
  const t = useTheme();

  const [tours, setTours] = useState<TourRow[]>([]);
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [{ data }, { data: user }] = await Promise.all([
      supabase
        .from('tours')
        .select(
          'id, title, status, tour_date, market, clients(name, company), tour_stops(count), stop_notes(count)',
        )
        .order('tour_date', { ascending: false, nullsFirst: false }),
      supabase.auth.getUser(),
    ]);

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

  const active = tours.filter((tour) => tour.status !== 'archived');
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <ScreenHeader
        title="Your tours"
        subtitle={name ? `${greeting}, ${name}` : greeting}
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
        ) : !active.length ? (
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
            <Label>{active.length} active</Label>

            {active.map((tour) => {
              const client = Array.isArray(tour.clients) ? tour.clients[0] : tour.clients;
              const stops = tour.tour_stops?.[0]?.count ?? 0;
              const notes = tour.stop_notes?.[0]?.count ?? 0;
              const status = statusStyle(tour.status, t);

              return (
                <CardButton key={tour.id} onPress={() => router.push(`/tours/${tour.id}`)}>
                  <View style={{ gap: space.md }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        gap: space.md,
                      }}
                    >
                      <View style={{ flex: 1, gap: 3 }}>
                        <Heading numberOfLines={2}>{tour.title}</Heading>
                        {client ? (
                          <Muted>{client.company ?? client.name}</Muted>
                        ) : null}
                      </View>
                      <Pill bg={status.bg} fg={status.fg}>
                        {status.label}
                      </Pill>
                    </View>

                    <View style={{ flexDirection: 'row', gap: space.lg, flexWrap: 'wrap' }}>
                      {tour.tour_date ? (
                        <Meta icon="calendar-outline" text={formatTourDate(tour.tour_date) ?? ''} />
                      ) : null}
                      {tour.market ? <Meta icon="location-outline" text={tour.market} /> : null}
                      <Meta icon="business-outline" text={`${stops} stop${stops === 1 ? '' : 's'}`} />
                    </View>

                    {notes > 0 ? (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: space.sm,
                          backgroundColor: t.accentSoft,
                          borderRadius: radius.md,
                          paddingHorizontal: space.md,
                          paddingVertical: space.sm,
                        }}
                      >
                        <Ionicons name="chatbubble-ellipses" size={15} color={t.accent} />
                        <BodyStrong style={{ color: t.accent, fontSize: 14 }}>
                          {notes} piece{notes === 1 ? '' : 's'} of client feedback
                        </BodyStrong>
                      </View>
                    ) : stops > 0 ? (
                      <Progress value={0} />
                    ) : null}
                  </View>
                </CardButton>
              );
            })}
          </>
        )}
      </ScreenBody>
    </>
  );
}

function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Ionicons name={icon} size={14} color={t.textFaint} />
      <Caption>{text}</Caption>
    </View>
  );
}
