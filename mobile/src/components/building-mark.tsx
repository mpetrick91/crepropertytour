import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

import { markGradient, markInitials, radius, space } from '@/lib/theme';

/**
 * The coloured tile that stands in for a building.
 *
 * Buildings have no photograph in this product -- brochures are PDFs and nobody
 * is going to upload a hero image before a tour. So identity has to come from
 * somewhere else: a stable colour and a monogram, derived from the address
 * itself. Same building, same tile, every screen it appears on.
 */
export function BuildingMark({
  name,
  address,
  size = 48,
  badge,
}: {
  name?: string | null;
  address: string;
  size?: number;
  /** A number in the corner, for a building's position on an itinerary. */
  badge?: number;
}) {
  const colors = markGradient(address || name || '');
  const initials = markInitials(name, address);

  return (
    <View>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: size,
          height: size,
          borderRadius: size >= 56 ? radius.lg : radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <Text
          style={{
            color: '#fff',
            fontSize: size * 0.36,
            fontWeight: '800',
            letterSpacing: -0.5,
          }}
        >
          {initials}
        </Text>
      </LinearGradient>

      {badge !== undefined ? (
        <View
          style={{
            position: 'absolute',
            top: -5,
            left: -5,
            minWidth: 21,
            height: 21,
            paddingHorizontal: 5,
            borderRadius: radius.pill,
            backgroundColor: '#FAA61A',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: '#fff',
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '900', color: '#0A2158' }}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * The buildings on a tour, overlapped into a single glyph.
 *
 * Lets a tour card say "these five, in this order" in the width of a thumbnail,
 * which is what makes the list scannable without opening anything.
 */
export function BuildingStack({
  buildings,
  max = 4,
  size = 34,
  ring = '#fff',
}: {
  buildings: { name?: string | null; address: string }[];
  max?: number;
  size?: number;
  /** The colour separating overlapped tiles -- match the surface behind them. */
  ring?: string;
}) {
  const shown = buildings.slice(0, max);
  const extra = buildings.length - shown.length;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {shown.map((building, index) => (
        <View
          key={`${building.address}-${index}`}
          style={{
            // Shallow enough that both letters of the monogram stay visible;
            // any deeper and the stack becomes a row of coloured slivers.
            marginLeft: index === 0 ? 0 : -size * 0.2,
            borderWidth: 2.5,
            borderColor: ring,
            borderRadius: radius.md,
            // Later tiles sit on top, so the overlap reads left-to-right in
            // the same direction as the itinerary.
            zIndex: index,
          }}
        >
          <BuildingMark name={building.name} address={building.address} size={size} />
        </View>
      ))}

      {extra > 0 ? (
        <View style={{ marginLeft: space.sm }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#8A94A5' }}>+{extra}</Text>
        </View>
      ) : null}
    </View>
  );
}
