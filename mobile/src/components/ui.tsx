import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { forwardRef } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type TextProps,
  type ViewProps,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { elevation, radius, space, TAP, type as typeScale, useIsDark, useTheme } from '@/lib/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Haptics are a no-op on web, so the browser preview does not throw. */
function tap(style: 'light' | 'medium' | 'success' | 'warning' = 'light') {
  if (Platform.OS === 'web') return;
  if (style === 'success') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  } else if (style === 'warning') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  } else {
    Haptics.impactAsync(
      style === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
    ).catch(() => {});
  }
}

export { tap as haptic };

/* ── Type ──────────────────────────────────────────────────────────────── */

function textFactory(variant: keyof typeof typeScale, colorKey: 'text' | 'textMuted' | 'textFaint') {
  return function Component({ style, ...props }: TextProps) {
    const t = useTheme();
    return <Text style={[typeScale[variant], { color: t[colorKey] }, style]} {...props} />;
  };
}

export const Display = textFactory('display', 'text');
export const Title = textFactory('title', 'text');
export const Heading = textFactory('heading', 'text');
export const Body = textFactory('body', 'text');
export const BodyStrong = textFactory('bodyStrong', 'text');
export const Muted = textFactory('small', 'textMuted');
export const Caption = textFactory('caption', 'textFaint');
export const Label = textFactory('label', 'textFaint');

/* ── Pressable with a spring ───────────────────────────────────────────── */

/**
 * Everything tappable dips slightly and fades. It is a small thing, but the
 * absence of it is most of why a React Native screen feels like a web page.
 */
export function Touchable({
  children,
  onPress,
  haptic: hapticStyle = 'light',
  scaleTo = 0.97,
  style,
  disabled,
  ...props
}: PressableProps & {
  children: React.ReactNode;
  haptic?: 'light' | 'medium' | 'success' | 'warning' | 'none';
  scaleTo?: number;
}) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={() => {
        scale.value = withSpring(scaleTo, { damping: 18, stiffness: 320 });
        opacity.value = withTiming(0.9, { duration: 90 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 260 });
        opacity.value = withTiming(1, { duration: 140 });
      }}
      onPress={(event) => {
        if (hapticStyle !== 'none') tap(hapticStyle);
        onPress?.(event);
      }}
      style={[animated, { opacity: disabled ? 0.45 : 1 }, style as object]}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
}

/* ── Buttons ───────────────────────────────────────────────────────────── */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  busy,
  size = 'lg',
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  busy?: boolean;
  size?: 'lg' | 'md';
  style?: ViewProps['style'];
}) {
  const t = useTheme();
  const isDark = useIsDark();
  const inactive = disabled || busy;

  const palette = {
    primary: { bg: t.primary, fg: t.onPrimary, border: 'transparent', lift: 2 as const },
    secondary: { bg: t.surface, fg: t.text, border: t.border, lift: 1 as const },
    ghost: { bg: 'transparent', fg: t.textMuted, border: 'transparent', lift: 0 as const },
    danger: { bg: t.dangerSoft, fg: t.danger, border: 'transparent', lift: 0 as const },
  }[variant];

  return (
    <Touchable
      onPress={onPress}
      disabled={inactive}
      haptic={variant === 'danger' ? 'warning' : 'medium'}
      accessibilityState={{ disabled: Boolean(inactive), busy: Boolean(busy) }}
      style={[
        {
          minHeight: size === 'lg' ? TAP + 4 : TAP - 6,
          paddingHorizontal: size === 'lg' ? space.xl : space.lg,
          borderRadius: radius.md,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: palette.border === 'transparent' ? 0 : StyleSheet.hairlineWidth * 2,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.sm,
        },
        elevation(palette.lift, isDark),
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={palette.fg} />
      ) : icon ? (
        <Ionicons name={icon} size={size === 'lg' ? 20 : 17} color={palette.fg} />
      ) : null}
      <Text
        style={{
          color: palette.fg,
          fontSize: size === 'lg' ? 16.5 : 15,
          fontWeight: '700',
          letterSpacing: -0.2,
        }}
      >
        {title}
      </Text>
    </Touchable>
  );
}

/** Circular icon button, for row-level actions where a label would crowd. */
export function IconButton({
  icon,
  onPress,
  label,
  tone = 'neutral',
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
  tone?: 'neutral' | 'danger';
  disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      scaleTo={0.9}
      style={{
        width: TAP - 6,
        height: TAP - 6,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tone === 'danger' ? t.dangerSoft : t.surfaceSunken,
      }}
    >
      <Ionicons name={icon} size={19} color={tone === 'danger' ? t.danger : t.textMuted} />
    </Touchable>
  );
}

/* ── Surfaces ──────────────────────────────────────────────────────────── */

export function Card({
  style,
  level = 1,
  ...props
}: ViewProps & { level?: 0 | 1 | 2 | 3 }) {
  const t = useTheme();
  const isDark = useIsDark();
  return (
    <View
      style={[
        {
          backgroundColor: t.surfaceRaised,
          borderRadius: radius.lg,
          padding: space.lg,
          borderWidth: isDark ? StyleSheet.hairlineWidth : 0,
          borderColor: t.border,
        },
        elevation(level, isDark),
        style,
      ]}
      {...props}
    />
  );
}

/** A whole card that responds to touch. */
export function CardButton({
  onPress,
  children,
  style,
}: {
  onPress: () => void;
  children: React.ReactNode;
  style?: ViewProps['style'];
}) {
  const t = useTheme();
  const isDark = useIsDark();
  return (
    <Touchable
      onPress={onPress}
      scaleTo={0.985}
      style={[
        {
          backgroundColor: t.surfaceRaised,
          borderRadius: radius.lg,
          padding: space.lg,
          borderWidth: isDark ? StyleSheet.hairlineWidth : 0,
          borderColor: t.border,
        },
        elevation(1, isDark),
        style,
      ]}
    >
      {children}
    </Touchable>
  );
}

/**
 * Broker-only content. Loud on purpose: the entire privacy model rests on this
 * text never reaching a client, so it must be unmistakable at a glance.
 */
export function InternalNote({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.internalSoft,
        borderRadius: radius.md,
        padding: space.md,
        gap: space.xs,
        borderLeftWidth: 3,
        borderLeftColor: t.internal,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        <Ionicons name="eye-off" size={12} color={t.internal} />
        <Text style={[typeScale.label, { color: t.internal }]}>Only you can see this</Text>
      </View>
      <Text style={[typeScale.small, { color: t.text }]}>{children}</Text>
    </View>
  );
}

/* ── Inputs ────────────────────────────────────────────────────────────── */

export const Field = forwardRef<
  TextInput,
  TextInputProps & { label: string; hint?: string; internal?: boolean; icon?: keyof typeof Ionicons.glyphMap }
>(function Field({ label, hint, internal, icon, style, ...props }, ref) {
  const t = useTheme();
  return (
    <View style={{ gap: space.xs }}>
      <Text style={[typeScale.caption, { color: internal ? t.internal : t.textMuted }]}>
        {internal ? `${label.toUpperCase()} · PRIVATE` : label.toUpperCase()}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          backgroundColor: internal ? t.internalSoft : t.surfaceSunken,
          borderRadius: radius.md,
          paddingHorizontal: space.lg,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: internal ? t.internalBorder : 'transparent',
        }}
      >
        {icon ? <Ionicons name={icon} size={18} color={t.textFaint} /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={t.textFaint}
          style={[
            {
              flex: 1,
              minHeight: TAP,
              paddingVertical: space.md,
              color: t.text,
              fontSize: 16.5,
            },
            style,
          ]}
          {...props}
        />
      </View>
      {hint ? <Caption style={{ marginLeft: space.xs }}>{hint}</Caption> : null}
    </View>
  );
});

/* ── Feedback ──────────────────────────────────────────────────────────── */

export function ErrorText({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  if (!children) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: space.sm,
        alignItems: 'flex-start',
        backgroundColor: t.dangerSoft,
        borderRadius: radius.md,
        padding: space.md,
      }}
      accessibilityLiveRegion="polite"
    >
      <Ionicons name="alert-circle" size={17} color={t.danger} style={{ marginTop: 1 }} />
      <Text style={[typeScale.small, { color: t.danger, flex: 1 }]}>{children}</Text>
    </View>
  );
}

export function Pill({
  children,
  bg,
  fg,
  icon,
}: {
  children: React.ReactNode;
  bg?: string;
  fg?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: bg ?? t.surfaceSunken,
        borderRadius: radius.pill,
        paddingHorizontal: space.md,
        paddingVertical: 5,
      }}
    >
      {icon ? <Ionicons name={icon} size={12} color={fg ?? t.textMuted} /> : null}
      <Text style={{ fontSize: 12.5, fontWeight: '700', color: fg ?? t.textMuted }}>
        {children}
      </Text>
    </View>
  );
}

/** Numbered stop marker. The number is the order of the walkthrough. */
export function StopNumber({ n, done }: { n: number; done?: boolean }) {
  const t = useTheme();
  return (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: radius.pill,
        backgroundColor: done ? t.success : t.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {done ? (
        <Ionicons name="checkmark" size={17} color="#fff" />
      ) : (
        <Text style={{ color: t.onPrimary, fontSize: 14, fontWeight: '800' }}>{n}</Text>
      )}
    </View>
  );
}

/** Thin progress bar. Used for "3 of 5 buildings seen". */
export function Progress({ value }: { value: number }) {
  const t = useTheme();
  const width = useSharedValue(0);
  width.value = withTiming(Math.max(0, Math.min(1, value)), { duration: 600 });
  const bar = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));

  return (
    <View
      style={{
        height: 6,
        borderRadius: radius.pill,
        backgroundColor: t.surfaceSunken,
        overflow: 'hidden',
      }}
    >
      <Animated.View style={[{ height: '100%', backgroundColor: t.accent }, bar]} />
    </View>
  );
}

export function Empty({
  icon = 'file-tray-outline',
  title,
  children,
  action,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.xxxl, gap: space.md }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: radius.pill,
          backgroundColor: t.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={32} color={t.primary} />
      </View>
      <Heading style={{ textAlign: 'center' }}>{title}</Heading>
      {children ? (
        <Muted style={{ textAlign: 'center', maxWidth: 300 }}>{children}</Muted>
      ) : null}
      {action ? <View style={{ marginTop: space.sm }}>{action}</View> : null}
    </View>
  );
}

/** Tappable stars. Big targets — this gets used one-handed in a parking lot. */
export function Stars({
  value,
  onChange,
  size = 34,
}: {
  value: number | null;
  onChange?: (next: number | null) => void;
  size?: number;
}) {
  const t = useTheme();
  const readOnly = !onChange;

  return (
    <View style={{ flexDirection: 'row', gap: readOnly ? 1 : 2 }} accessibilityRole="radiogroup">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = Boolean(value && n <= value);
        const star = (
          <Ionicons
            name={filled ? 'star' : 'star-outline'}
            size={size}
            color={filled ? t.gold : t.textFaint}
          />
        );

        if (readOnly) return <View key={n}>{star}</View>;

        return (
          <Touchable
            key={n}
            scaleTo={0.85}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === n }}
            accessibilityLabel={`${n} out of 5`}
            onPress={() => onChange?.(value === n ? null : n)}
            style={{ padding: 3 }}
          >
            {star}
          </Touchable>
        );
      })}
    </View>
  );
}
