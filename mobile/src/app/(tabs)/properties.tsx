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
  Label,
  Muted,
  Touchable,
} from '@/components/ui';
import { cityState, formatRate, formatSf } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { radius, space, useTheme } from '@/lib/theme';
import type { Property } from '@/lib/types';

export default function PropertiesScreen() {
  const router = useRouter();
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
    <>
      <ScreenHeader
        title="Buildings"
        subtitle="Your library"
        right={
          <Touchable
            onPress={() => router.push('/properties/new')}
            accessibilityLabel="Add building"
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
        ) : !properties.length ? (
          <Empty
            icon="business-outline"
            title="No buildings yet"
            action={
              <Button title="Add a building" icon="add" onPress={() => router.push('/properties/new')} />
            }
          >
            Add the options you&apos;re tracking. You&apos;ll drop them onto tours from here.
          </Empty>
        ) : (
          <>
            <Label>
              {properties.length} building{properties.length === 1 ? '' : 's'}
            </Label>

            {properties.map((property) => {
              const sf = formatSf(property.available_sf);
              const rate = formatRate(property.rent_rate, property.rent_type);

              return (
                <CardButton
                  key={property.id}
                  onPress={() => router.push(`/properties/${property.id}`)}
                >
                  <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: radius.md,
                        backgroundColor: t.primarySoft,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="business" size={22} color={t.primary} />
                    </View>

                    <View style={{ flex: 1, gap: 2 }}>
                      <BodyStrong numberOfLines={1}>
                        {property.name ?? property.address_line1}
                      </BodyStrong>
                      <Caption numberOfLines={1}>
                        {[property.address_line1, cityState(property.city, property.state)]
                          .filter(Boolean)
                          .join(' · ')}
                      </Caption>
                      {sf || rate ? (
                        <Muted style={{ fontSize: 13.5, fontVariant: ['tabular-nums'] }}>
                          {[sf, rate].filter(Boolean).join('  ·  ')}
                        </Muted>
                      ) : null}
                    </View>

                    <Ionicons name="chevron-forward" size={18} color={t.textFaint} />
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
