import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Card, Empty, Muted, Title } from '@/components/ui';
import { cityState, formatRate, formatSf } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { spacing, useTheme } from '@/lib/theme';
import type { Property } from '@/lib/types';

export default function PropertiesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTheme();

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('properties')
      .select('*')
      .order('created_at', { ascending: false });
    setProperties(data ?? []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

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
      <Title>Properties</Title>
      <Muted>Your building library. Add options here, then drop them onto a tour.</Muted>

      <Button title="Add property" onPress={() => router.push('/properties/new')} />

      {loading ? (
        <ActivityIndicator color={t.accent} />
      ) : !properties.length ? (
        <Empty>No properties yet.</Empty>
      ) : (
        properties.map((property) => {
          const details = [
            formatSf(property.available_sf),
            formatRate(property.rent_rate, property.rent_type),
          ].filter(Boolean);

          return (
            <Pressable
              key={property.id}
              accessibilityRole="button"
              onPress={() => router.push(`/properties/${property.id}`)}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Card style={{ gap: 2 }}>
                <Body style={{ fontWeight: '600' }}>
                  {property.name ?? property.address_line1}
                </Body>
                <Muted>
                  {[property.address_line1, cityState(property.city, property.state)]
                    .filter(Boolean)
                    .join(' · ')}
                </Muted>
                {details.length ? <Muted>{details.join(' · ')}</Muted> : null}
              </Card>
            </Pressable>
          );
        })
      )}

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}
