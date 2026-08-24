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
  FadeInDown,
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
    // Folded in here rather than layered as a second style: Reanimated writes
    // opacity directly, so a static rule alongside it never took effect and
    // disabled controls looked tappable.
    opacity: opacity.value * (disabled ? 0.4 : 1),
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={() => {
        scale.value = withSpring(scaleTo, { damping: 26, stiffness: 340, overshootClamping: true });
        opacity.value = withTiming(0.9, { duration: 90 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 26, stiffness: 300, overshootClamping: true });
        opacity.value = withTiming(1, { duration: 140 });
      }}
      onPress={(event) => {
        if (hapticStyle !== 'none') tap(hapticStyle);
        onPress?.(event);
      }}
      style={[animated, style as object]}
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
 * Broker-only content.
 *
 * Amber belongs to the brand now, so "private" cannot be signalled with colour
 * without competing with it. Instead this is recessed: a sunken slate panel
 * with a dashed edge and a lock, reading as something sitting *behind* the
 * page rather than on it. Distinct by treatment, which survives a palette
 * change in a way a hue would not.
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
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: t.internalBorder,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Ionicons name="lock-closed" size={11} color={t.internal} />
        <Text style={[typeScale.label, { color: t.internal }]}>Private to you</Text>
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

/* ── Motion ────────────────────────────────────────────────────────────── */

/**
 * Fades a list item up as it arrives, each one slightly after the last.
 *
 * A list that simply exists when a screen opens is the single clearest tell
 * that something is a web page. Staggering the arrival costs nothing and makes
 * the same list feel assembled rather than dumped.
 */
export function Appear({
  index = 0,
  children,
  style,
}: {
  index?: number;
  children: React.ReactNode;
  style?: ViewProps['style'];
}) {
  return (
    <Animated.View
      // Capped so the twentieth card is not still animating in a second later.
      // Timing, not a spring: a spring overshoots its resting position, and a
      // screenful of cards each overshooting a moment apart reads as the page
      // shaking rather than as anything arriving.
      entering={FadeInDown.delay(Math.min(index, 8) * 45).duration(260)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

/* ── Segmented control ─────────────────────────────────────────────────── */

/**
 * Two or three exclusive choices, with the selection sliding between them
 * rather than blinking. Cheaper to read than a row of buttons because there is
 * only ever one filled shape on screen.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const t = useTheme();
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  const offset = useSharedValue(index);

  offset.value = withSpring(index, { damping: 24, stiffness: 260, overshootClamping: true });

  const thumb = useAnimatedStyle(() => ({
    left: `${(offset.value * 100) / options.length}%`,
    width: `${100 / options.length}%`,
  }));

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: t.surfaceSunken,
        borderRadius: radius.pill,
        padding: 4,
      }}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 4,
            bottom: 4,
            marginLeft: 4,
            paddingRight: 8,
          },
          thumb,
        ]}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: t.surface,
            borderRadius: radius.pill,
            ...elevation(1, false),
          }}
        />
      </Animated.View>

      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) tap('light');
              onChange(option.value);
            }}
            style={{
              flex: 1,
              minHeight: 38,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 6,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '700',
                color: selected ? t.text : t.textMuted,
              }}
            >
              {option.label}
            </Text>
            {option.count !== undefined ? (
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: selected ? t.primary : t.textFaint,
                }}
              >
                {option.count}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/* ── Stats ─────────────────────────────────────────────────────────────── */

/**
 * A number with its unit under it. Reads as a fact at a glance, where the same
 * thing written as "3 stops · 2 notes" has to be parsed word by word.
 */
export function Stat({
  value,
  label,
  icon,
  tone = 'default',
}: {
  value: string | number;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: 'default' | 'accent' | 'success';
}) {
  const t = useTheme();
  const color = tone === 'accent' ? t.accentInk : tone === 'success' ? t.success : t.text;

  return (
    <View style={{ flex: 1, gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        {icon ? <Ionicons name={icon} size={13} color={color} /> : null}
        <Text style={{ fontSize: 19, fontWeight: '800', color, letterSpacing: -0.4 }}>
          {value}
        </Text>
      </View>
      <Text style={[typeScale.label, { color: t.textFaint }]}>{label}</Text>
    </View>
  );
}

/** The row those sit in, divided so each number owns its column. */
export function StatRow({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: space.lg,
        paddingTop: space.md,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: t.border,
      }}
    >
      {children}
    </View>
  );
}

/* ── Section heading ───────────────────────────────────────────────────── */

/** A label with an optional action on the right. Gives a screen its joints. */
export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: -space.sm,
      }}
    >
      <Text style={[typeScale.label, { color: t.textFaint }]}>{title}</Text>
      {action ? (
        <Touchable onPress={() => onAction?.()} scaleTo={0.94} style={{ padding: space.xs }}>
          <Text style={{ fontSize: 13.5, fontWeight: '700', color: t.primary }}>{action}</Text>
        </Touchable>
      ) : null}
    </View>
  );
}
