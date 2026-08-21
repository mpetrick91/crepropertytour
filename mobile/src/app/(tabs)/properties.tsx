import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, Text, TextInput, View } from 'react-native';

import { BuildingMark } from '@/components/building-mark';
import { ScreenBody, ScreenHeader } from '@/components/screen';
import {
  Appear,
  BodyStrong,
  Button,
  Caption,
  CardButton,
  Empty,
  Muted,
  SectionHeader,
  Touchable,
} from '@/components/ui';
import { cityState, formatRate, formatSf } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { radius, space, TAP, useTheme } from '@/lib/theme';
import type { Property } from '@/lib/types';

/** Building type, as a word rather than a database value. */
const TYPE_LABEL: Record<string, string> = {
  office: 'Office',
  industrial: 'Industrial',
  flex: 'Flex',
  retail: 'Retail',
  land: 'Land',
  other: 'Other',
};

export default function PropertiesScreen() {
  const router = useRouter();
  const t = useTheme();

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

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

  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return properties;
    return properties.filter((property) =>
      [property.name, property.address_line1, property.city, property.state]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [properties, search]);

  return (
    <>
      <ScreenHeader
        title="Buildings"
        subtitle={properties.length ? `${properties.length} in your library` : 'Your library'}
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
            {/* Worth its place once a library outgrows one screen, which is
                after about six buildings. */}
            {properties.length > 5 ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.sm,
                  backgroundColor: t.surfaceSunken,
                  borderRadius: radius.pill,
                  paddingHorizontal: space.lg,
                }}
              >
                <Ionicons name="search" size={17} color={t.textFaint} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search address or city"
                  placeholderTextColor={t.textFaint}
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                  style={{ flex: 1, minHeight: TAP, color: t.text, fontSize: 16 }}
                />
              </View>
            ) : null}

            <SectionHeader
              title={
                search
                  ? `${matches.length} match${matches.length === 1 ? '' : 'es'}`
                  : `${properties.length} building${properties.length === 1 ? '' : 's'}`
              }
            />

            {!matches.length ? (
              <Muted style={{ textAlign: 'center', paddingVertical: space.xl }}>
                Nothing matches “{search.trim()}”.
              </Muted>
            ) : (
              matches.map((property, index) => {
                const sf = formatSf(property.available_sf);
                const rate = formatRate(property.rent_rate, property.rent_type);
                const type = TYPE_LABEL[property.property_type ?? 'other'];

                return (
                  <Appear key={property.id} index={index}>
                    <CardButton onPress={() => router.push(`/properties/${property.id}`)}>
                      <View style={{ gap: space.md }}>
                        <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
                          <BuildingMark
                            name={property.name}
                            address={property.address_line1}
                            size={52}
                          />

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

                          <Ionicons name="chevron-forward" size={18} color={t.textFaint} />
                        </View>

                        {/* The three numbers a broker checks first, in a fixed
                            order so the eye learns where to look. */}
                        {sf || rate || type ? (
                          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                            {sf ? <Spec icon="resize-outline" text={sf} /> : null}
                            {rate ? <Spec icon="pricetag-outline" text={rate} strong /> : null}
                            {type ? <Spec icon="business-outline" text={type} /> : null}
                            {property.clear_height_ft ? (
                              <Spec icon="arrow-up-outline" text={`${property.clear_height_ft}′ clear`} />
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    </CardButton>
                  </Appear>
                );
              })
            )}
          </>
        )}
      </ScreenBody>
    </>
  );
}

/** One spec, as a chip. Tabular figures so columns of them line up. */
function Spec({
  icon,
  text,
  strong,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  strong?: boolean;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: strong ? t.accentSoft : t.surfaceSunken,
        borderRadius: radius.sm,
        paddingHorizontal: space.sm + 2,
        paddingVertical: 6,
      }}
    >
      <Ionicons name={icon} size={12} color={strong ? t.accentInk : t.textMuted} />
      <Text
        style={{
          fontSize: 12.5,
          fontWeight: '700',
          color: strong ? t.accentInk : t.textMuted,
          fontVariant: ['tabular-nums'],
        }}
      >
        {text}
      </Text>
    </View>
  );
}
