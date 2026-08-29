import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Dimensions, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { elevation, radius, space, useIsDark, useTheme } from '@/lib/theme';

import { haptic, Touchable } from './ui';

/**
 * The photographs of a building.
 *
 * A broker walking a site takes the dock apron, the office, the clear height
 * and the yard -- so this is a strip, not a slot. The first photo is the cover
 * and leads at full width, because on the way to a tour the useful question is
 * "which building is this" and one large picture answers it faster than a row
 * of thumbnails.
 *
 * Tapping any photo opens it full screen, where they can be swiped through.
 */

const WINDOW_WIDTH = Dimensions.get('window').width;

export type GalleryPhoto = { id: string; uri: string | null; caption?: string | null };

export function PhotoGallery({
  photos,
  uploading,
  onAdd,
  onRemove,
  onMakeCover,
}: {
  photos: GalleryPhoto[];
  uploading: boolean;
  onAdd: (source: 'camera' | 'library') => void;
  onRemove: (id: string) => void;
  onMakeCover: (id: string) => void;
}) {
  const t = useTheme();
  const isDark = useIsDark();
  const [viewing, setViewing] = useState<number | null>(null);

  if (!photos.length) {
    return <EmptyPanel uploading={uploading} onAdd={onAdd} />;
  }

  const [cover, ...rest] = photos;

  return (
    <View style={{ gap: space.md }}>
      <Touchable
        onPress={() => setViewing(0)}
        scaleTo={0.99}
        haptic="none"
        accessibilityLabel="View photos full screen"
        style={[{ borderRadius: radius.lg, overflow: 'hidden' }, elevation(2, isDark)]}
      >
        {cover.uri ? (
          <Image
            source={{ uri: cover.uri }}
            style={{ width: '100%', height: 220 }}
            contentFit="cover"
            transition={200}
            accessibilityLabel={cover.caption ?? 'Photo of this building'}
          />
        ) : (
          <View
            style={{
              width: '100%',
              height: 220,
              backgroundColor: t.surfaceSunken,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="image-outline" size={26} color={t.textFaint} />
          </View>
        )}

        {photos.length > 1 ? (
          <View
            style={{
              position: 'absolute',
              left: space.md,
              bottom: space.md,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              backgroundColor: 'rgba(6,13,28,0.62)',
              paddingHorizontal: space.md,
              paddingVertical: 6,
              borderRadius: radius.pill,
            }}
          >
            <Ionicons name="images" size={13} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 12.5, fontWeight: '700' }}>
              {photos.length}
            </Text>
          </View>
        ) : null}
      </Touchable>

      {/* The rest as thumbnails, with adding at the end of the row where a
          new photo actually lands. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space.sm }}
      >
        {rest.map((photo, index) => (
          <Touchable
            key={photo.id}
            onPress={() => setViewing(index + 1)}
            scaleTo={0.94}
            haptic="none"
            accessibilityLabel="View photo"
            style={{ borderRadius: radius.md, overflow: 'hidden' }}
          >
            {photo.uri ? (
              <Image
                source={{ uri: photo.uri }}
                style={{ width: 84, height: 84 }}
                contentFit="cover"
                transition={150}
                accessibilityLabel={photo.caption ?? 'Photo of this building'}
              />
            ) : (
              <View style={{ width: 84, height: 84, backgroundColor: t.surfaceSunken }} />
            )}
          </Touchable>
        ))}

        <AddTile uploading={uploading} onAdd={onAdd} />
      </ScrollView>

      <Viewer
        photos={photos}
        index={viewing}
        onClose={() => setViewing(null)}
        onRemove={(id) => {
          setViewing(null);
          onRemove(id);
        }}
        onMakeCover={(id) => {
          setViewing(null);
          onMakeCover(id);
        }}
      />
    </View>
  );
}

function AddTile({
  uploading,
  onAdd,
}: {
  uploading: boolean;
  onAdd: (source: 'camera' | 'library') => void;
}) {
  const t = useTheme();

  return (
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      <Touchable
        onPress={() => onAdd('camera')}
        disabled={uploading}
        haptic="medium"
        scaleTo={0.94}
        accessibilityLabel="Take a photo"
        style={{
          width: 84,
          height: 84,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: t.borderStrong,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
        }}
      >
        {uploading ? (
          <ActivityIndicator size="small" color={t.primary} />
        ) : (
          <>
            <Ionicons name="camera" size={20} color={t.primary} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: t.primary }}>Take</Text>
          </>
        )}
      </Touchable>

      <Touchable
        onPress={() => onAdd('library')}
        disabled={uploading}
        haptic="medium"
        scaleTo={0.94}
        accessibilityLabel="Choose photos"
        style={{
          width: 84,
          height: 84,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: t.borderStrong,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
        }}
      >
        <Ionicons name="images-outline" size={20} color={t.primary} />
        <Text style={{ fontSize: 11, fontWeight: '700', color: t.primary }}>Add</Text>
      </Touchable>
    </View>
  );
}

function EmptyPanel({
  uploading,
  onAdd,
}: {
  uploading: boolean;
  onAdd: (source: 'camera' | 'library') => void;
}) {
  const t = useTheme();

  return (
    <View
      style={{
        height: 170,
        borderRadius: radius.lg,
        backgroundColor: t.surfaceSunken,
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.md,
        padding: space.lg,
      }}
    >
      {uploading ? (
        <>
          <ActivityIndicator color={t.primary} />
          <Text style={{ color: t.textMuted, fontSize: 14 }}>Saving…</Text>
        </>
      ) : (
        <>
          <Ionicons name="images-outline" size={28} color={t.textFaint} />
          <Text style={{ color: t.textMuted, fontSize: 14 }}>No photos of this building yet.</Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <PillButton icon="camera" label="Take one" onPress={() => onAdd('camera')} solid />
            <PillButton icon="images-outline" label="Choose" onPress={() => onAdd('library')} />
          </View>
        </>
      )}
    </View>
  );
}

function PillButton({
  icon,
  label,
  onPress,
  solid,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  solid?: boolean;
}) {
  const t = useTheme();
  return (
    <Touchable
      onPress={onPress}
      haptic="medium"
      scaleTo={0.95}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: space.lg,
        paddingVertical: space.sm + 2,
        borderRadius: radius.pill,
        backgroundColor: solid ? t.primary : t.surface,
      }}
    >
      <Ionicons name={icon} size={15} color={solid ? t.onPrimary : t.primary} />
      <Text style={{ fontSize: 14, fontWeight: '700', color: solid ? t.onPrimary : t.primary }}>
        {label}
      </Text>
    </Touchable>
  );
}

/**
 * Full screen, swipeable, on black.
 *
 * Photographs of a loading dock are read for detail -- is that apron wide
 * enough, how tight is that turn -- and a thumbnail cannot answer that.
 */
function Viewer({
  photos,
  index,
  onClose,
  onRemove,
  onMakeCover,
}: {
  photos: GalleryPhoto[];
  index: number | null;
  onClose: () => void;
  onRemove: (id: string) => void;
  onMakeCover: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(index ?? 0);

  if (index === null) return null;

  const active = photos[current] ?? photos[0];
  if (!active) return null;

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: 0, y: 0 }}
          onMomentumScrollEnd={(event) => {
            const width = event.nativeEvent.layoutMeasurement.width;
            setCurrent(Math.round(event.nativeEvent.contentOffset.x / width));
          }}
          style={{ flex: 1 }}
        >
          {photos.map((photo) => (
            <View
              key={photo.id}
              style={{ width: WINDOW_WIDTH, flex: 1, alignItems: 'center', justifyContent: 'center' }}
            >
              {photo.uri ? (
                <Image
                  source={{ uri: photo.uri }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="contain"
                  accessibilityLabel={photo.caption ?? 'Photo of this building'}
                />
              ) : (
                <Text style={{ color: '#fff' }}>This photo could not be loaded.</Text>
              )}
            </View>
          ))}
        </ScrollView>

        <View
          style={{
            position: 'absolute',
            top: insets.top + space.sm,
            left: space.lg,
            right: space.lg,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <ViewerButton icon="close" label="Close" onPress={onClose} />
          <View style={{ flex: 1 }} />
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '700' }}>
            {current + 1} / {photos.length}
          </Text>
        </View>

        <View
          style={{
            position: 'absolute',
            bottom: insets.bottom + space.lg,
            left: space.lg,
            right: space.lg,
            flexDirection: 'row',
            gap: space.sm,
            justifyContent: 'center',
          }}
        >
          {current !== 0 ? (
            <ViewerButton
              icon="star-outline"
              label="Make this the cover"
              wide="Make cover"
              onPress={() => {
                haptic('success');
                onMakeCover(active.id);
              }}
            />
          ) : null}
          <ViewerButton
            icon="trash-outline"
            label="Delete this photo"
            wide="Delete"
            danger
            onPress={() => onRemove(active.id)}
          />
        </View>
      </View>
    </Modal>
  );
}

function ViewerButton({
  icon,
  label,
  wide,
  danger,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  wide?: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: wide ? space.lg : 0,
        width: wide ? undefined : 40,
        height: 40,
        justifyContent: 'center',
        borderRadius: radius.pill,
        backgroundColor: danger ? 'rgba(196,54,44,0.85)' : 'rgba(255,255,255,0.18)',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={18} color="#fff" />
      {wide ? (
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{wide}</Text>
      ) : null}
    </Pressable>
  );
}
