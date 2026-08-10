import { forwardRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextProps,
  type ViewProps,
} from 'react-native';

import { radius, spacing, TAP_TARGET, useTheme } from '@/lib/theme';

export function Title({ style, ...props }: TextProps) {
  const t = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={[{ color: t.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.4 }, style]}
      {...props}
    />
  );
}

export function Heading({ style, ...props }: TextProps) {
  const t = useTheme();
  return (
    <Text style={[{ color: t.text, fontSize: 17, fontWeight: '600' }, style]} {...props} />
  );
}

export function Body({ style, ...props }: TextProps) {
  const t = useTheme();
  return <Text style={[{ color: t.text, fontSize: 15, lineHeight: 21 }, style]} {...props} />;
}

export function Muted({ style, ...props }: TextProps) {
  const t = useTheme();
  return (
    <Text style={[{ color: t.textMuted, fontSize: 14, lineHeight: 20 }, style]} {...props} />
  );
}

export function SectionLabel({ style, ...props }: TextProps) {
  const t = useTheme();
  return (
    <Text
      style={[
        {
          color: t.textFaint,
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 1,
          textTransform: 'uppercase',
        },
        style,
      ]}
      {...props}
    />
  );
}

export function Card({ style, ...props }: ViewProps) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.background,
          borderColor: t.border,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderRadius: radius.md,
          padding: spacing.lg,
        },
        style,
      ]}
      {...props}
    />
  );
}

/**
 * Broker-only content. Deliberately loud: the whole security model rests on
 * this text never reaching a client, so it should be obvious on sight which
 * box that is.
 */
export function InternalNote({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.internalBg,
        borderColor: t.internalBorder,
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderRadius: radius.sm,
        padding: spacing.md,
        gap: 2,
      }}
    >
      <Text
        style={{
          color: t.internal,
          fontSize: 10,
          fontWeight: '800',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        }}
      >
        Internal · not shown to client
      </Text>
      <Text style={{ color: t.text, fontSize: 14, lineHeight: 20 }}>{children}</Text>
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  busy,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  busy?: boolean;
  style?: ViewProps['style'];
}) {
  const t = useTheme();
  const inactive = disabled || busy;

  const palette =
    variant === 'primary'
      ? { bg: t.accent, fg: t.onAccent, border: t.accent }
      : variant === 'danger'
        ? { bg: 'transparent', fg: t.danger, border: t.danger }
        : { bg: 'transparent', fg: t.text, border: t.border };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(inactive), busy: Boolean(busy) }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        {
          minHeight: TAP_TARGET,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderRadius: radius.md,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: StyleSheet.hairlineWidth * 2,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: spacing.sm,
          opacity: inactive ? 0.5 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={palette.fg} /> : null}
      <Text style={{ color: palette.fg, fontSize: 16, fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );
}

export const Field = forwardRef<
  TextInput,
  TextInputProps & { label: string; hint?: string; internal?: boolean }
>(function Field({ label, hint, internal, style, ...props }, ref) {
  const t = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ color: t.text, fontSize: 14, fontWeight: '600' }}>{label}</Text>
      <TextInput
        ref={ref}
        placeholderTextColor={t.textFaint}
        style={[
          {
            minHeight: TAP_TARGET,
            borderWidth: StyleSheet.hairlineWidth * 2,
            borderColor: internal ? t.internalBorder : t.border,
            backgroundColor: internal ? t.internalBg : t.background,
            borderRadius: radius.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
            color: t.text,
            fontSize: 16,
          },
          style,
        ]}
        {...props}
      />
      {hint ? <Text style={{ color: t.textFaint, fontSize: 12 }}>{hint}</Text> : null}
    </View>
  );
});

export function ErrorText({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  if (!children) return null;
  return (
    <Text style={{ color: t.danger, fontSize: 14, lineHeight: 20 }} accessibilityLiveRegion="polite">
      {children}
    </Text>
  );
}

export function Badge({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.surface,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.md,
        paddingVertical: 4,
      }}
    >
      <Text style={{ color: t.textMuted, fontSize: 12 }}>{children}</Text>
    </View>
  );
}

/** Numbered marker for a stop. The number is the order of the walkthrough. */
export function StopNumber({ n }: { n: number }) {
  const t = useTheme();
  return (
    <View
      style={{
        width: 26,
        height: 26,
        borderRadius: radius.sm,
        backgroundColor: t.accent,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: t.onAccent, fontSize: 13, fontWeight: '800' }}>{n}</Text>
    </View>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={{
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderColor: t.border,
        borderStyle: 'dashed',
        borderRadius: radius.md,
        padding: spacing.xxl,
        alignItems: 'center',
      }}
    >
      <Muted style={{ textAlign: 'center' }}>{children}</Muted>
    </View>
  );
}

export function Stars({
  value,
  onChange,
  size = 28,
}: {
  value: number | null;
  onChange?: (next: number | null) => void;
  size?: number;
}) {
  const t = useTheme();
  const readOnly = !onChange;

  return (
    <View style={{ flexDirection: 'row', gap: 2 }} accessibilityRole="radiogroup">
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          disabled={readOnly}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === n }}
          accessibilityLabel={`${n} out of 5`}
          onPress={() => onChange?.(value === n ? null : n)}
          hitSlop={6}
          style={{
            minWidth: readOnly ? undefined : TAP_TARGET / 1.4,
            minHeight: readOnly ? undefined : TAP_TARGET,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontSize: size,
              color: value && n <= value ? t.star : t.textFaint,
              opacity: value && n <= value ? 1 : 0.4,
            }}
          >
            ★
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
