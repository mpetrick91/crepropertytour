import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Caption, Title, Touchable } from '@/components/ui';
import { headerGradient, radius, space, useTheme } from '@/lib/theme';

/**
 * The coloured header every screen opens with.
 *
 * A gradient band rather than a plain navigation bar: it gives the app a top
 * edge you recognise instantly, and it lets the title be big enough to read at
 * arm's length while walking.
 */
export function ScreenHeader({
  title,
  subtitle,
  back,
  right,
  compact,
}: {
  title: string;
  subtitle?: string | null;
  back?: boolean;
  right?: React.ReactNode;
  compact?: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <>
      <StatusBar style="light" />
      <LinearGradient
        colors={headerGradient(t)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingTop: insets.top + space.md,
          paddingBottom: compact ? space.lg : space.xxl,
          paddingHorizontal: space.lg,
          borderBottomLeftRadius: radius.xl,
          borderBottomRightRadius: radius.xl,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          {back ? (
            <Touchable
              onPress={() => router.back()}
              accessibilityLabel="Go back"
              scaleTo={0.88}
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.pill,
                backgroundColor: 'rgba(255,255,255,0.16)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </Touchable>
          ) : null}

          <View style={{ flex: 1, gap: 2 }}>
            {subtitle ? (
              <Caption style={{ color: 'rgba(255,255,255,0.75)' }}>{subtitle}</Caption>
            ) : null}
            <Title style={{ color: '#fff' }} numberOfLines={2}>
              {title}
            </Title>
          </View>

          {right}
        </View>
      </LinearGradient>
    </>
  );
}

/**
 * Body of a screen. Pulls the content up over the header's rounded edge so the
 * two read as one surface, and keeps the last control clear of the home bar.
 */
export function ScreenBody({
  children,
  style,
  contentContainerStyle,
  overlap = true,
  ...props
}: ScrollViewProps & { children: React.ReactNode; overlap?: boolean }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: t.canvas }, style]}
      contentContainerStyle={[
        {
          padding: space.lg,
          paddingTop: overlap ? space.lg : space.xl,
          paddingBottom: insets.bottom + space.xxxl,
          gap: space.lg,
        },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...props}
    >
      {children}
    </ScrollView>
  );
}

export function Screen({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <View style={{ flex: 1, backgroundColor: t.canvas }}>{children}</View>;
}
