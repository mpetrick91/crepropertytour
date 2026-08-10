import { Link, Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge, Body, Button, Card, Empty, Heading, Muted, SectionLabel, Title } from '@/components/ui';
import { formatTourDate, statusLabel } from '@/lib/format';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { spacing, useTheme } from '@/lib/theme';

type TourRow = {
  id: string;
  title: string;
  status: string;
  tour_date: string | null;
  market: string | null;
  clients: { name: string; company: string | null } | { name: string; company: string | null }[] | null;
  tour_stops: { count: number }[];
};

export default function ToursScreen() {
  const { isBroker, loading: sessionLoading } = useSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTheme();

  const [tours, setTours] = useState<TourRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('tours')
      .select('id, title, status, tour_date, market, clients(name, company), tour_stops(count)')
      .order('tour_date', { ascending: false, nullsFirst: false });
    setTours((data as TourRow[] | null) ?? []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  // Reload on focus: coming back from the tour builder should show the change.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (sessionLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={t.accent} />
      </View>
    );
  }
  if (!isBroker) return <Redirect href="/login" />;

  return (
    <ScrollView
      contentContainerStyle={{
        padding: spacing.lg,
        paddingBottom: insets.bottom + spacing.xxl,
        gap: spacing.lg,
      }}
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
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Title>Tours</Title>
        <Link href="/properties" asChild>
          <Pressable hitSlop={10} accessibilityRole="link">
            <Muted style={{ textDecorationLine: 'underline' }}>Properties</Muted>
          </Pressable>
        </Link>
      </View>

      <Button title="New tour" onPress={() => router.push('/tours/new')} />

      {loading ? (
        <ActivityIndicator color={t.accent} />
      ) : !tours.length ? (
        <Empty>No tours yet. Add a few properties, then build your first tour.</Empty>
      ) : (
        <View style={{ gap: spacing.md }}>
          <SectionLabel>All tours</SectionLabel>
          {tours.map((tour) => {
            const client = Array.isArray(tour.clients) ? tour.clients[0] : tour.clients;
            const stopCount = tour.tour_stops?.[0]?.count ?? 0;

            return (
              <Pressable
                key={tour.id}
                accessibilityRole="button"
                onPress={() => router.push(`/tours/${tour.id}`)}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Card style={{ gap: spacing.xs }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: spacing.md,
                    }}
                  >
                    <Heading style={{ flex: 1 }}>{tour.title}</Heading>
                    <Badge>{statusLabel(tour.status)}</Badge>
                  </View>
                  <Muted>
                    {[
                      client?.company ?? client?.name,
                      formatTourDate(tour.tour_date),
                      tour.market,
                      `${stopCount} stop${stopCount === 1 ? '' : 's'}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Muted>
                </Card>
              </Pressable>
            );
          })}
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        onPress={async () => {
          await supabase.auth.signOut();
          router.replace('/');
        }}
        style={{ marginTop: spacing.xl, alignSelf: 'center' }}
        hitSlop={10}
      >
        <Body style={{ color: t.textMuted, textDecorationLine: 'underline' }}>Sign out</Body>
      </Pressable>
    </ScrollView>
  );
}
