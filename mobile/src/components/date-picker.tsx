import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { elevation, radius, space, TAP, type as typeScale, useIsDark, useTheme } from '@/lib/theme';

import { haptic, Touchable } from './ui';

/**
 * Picking a tour date.
 *
 * This used to be a text box that wanted "2026-08-14" typed into it, which is
 * the single least forgivable thing in a phone app: it asks a person standing
 * on a sidewalk to remember a date format. Most tours are booked for the next
 * couple of weeks, so the shortcuts answer it in one tap and the calendar is
 * there for everything else.
 *
 * Built here rather than pulled in, because the platform picker cannot be
 * styled to match and a dependency for one field is a poor trade.
 */

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** The `date` column wants YYYY-MM-DD, in local time rather than UTC. */
export function toIsoDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function fromIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addDays(days: number): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

/** The next occurrence of a weekday, never today. */
function nextWeekday(target: number): Date {
  const date = addDays(1);
  while (date.getDay() !== target) date.setDate(date.getDate() + 1);
  return date;
}

/** How a chosen date should read back: "Fri, Aug 14" rather than the raw value. */
export function friendlyDate(value: string | null | undefined): string | null {
  const date = value ? fromIsoDate(value) : null;
  if (!date) return null;

  const today = addDays(0);
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';

  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function DateField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const chosen = friendlyDate(value);

  return (
    <View style={{ gap: space.xs }}>
      <Text style={[typeScale.caption, { color: t.textMuted }]}>{label.toUpperCase()}</Text>

      <Touchable
        onPress={() => setOpen(true)}
        scaleTo={0.98}
        accessibilityLabel={chosen ? `${label}: ${chosen}` : `Choose a ${label.toLowerCase()}`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          minHeight: TAP,
          paddingHorizontal: space.lg,
          backgroundColor: t.surfaceSunken,
          borderRadius: radius.md,
        }}
      >
        <Ionicons name="calendar-outline" size={18} color={chosen ? t.primary : t.textFaint} />
        <Text style={{ flex: 1, fontSize: 16.5, color: chosen ? t.text : t.textFaint }}>
          {chosen ?? 'Choose a date'}
        </Text>
        {chosen ? (
          <Pressable
            onPress={() => {
              haptic('light');
              onChange('');
            }}
            hitSlop={12}
            accessibilityLabel="Clear date"
          >
            <Ionicons name="close-circle" size={19} color={t.textFaint} />
          </Pressable>
        ) : null}
      </Touchable>

      {hint ? <Text style={[typeScale.caption, { color: t.textFaint }]}>{hint}</Text> : null}

      <DateSheet
        open={open}
        value={value}
        onClose={() => setOpen(false)}
        onPick={(picked) => {
          onChange(picked);
          setOpen(false);
        }}
      />
    </View>
  );
}

function DateSheet({
  open,
  value,
  onPick,
  onClose,
}: {
  open: boolean;
  value: string;
  onPick: (value: string) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  const isDark = useIsDark();

  const selected = fromIsoDate(value);
  const [month, setMonth] = useState(() => {
    const start = selected ?? new Date();
    return new Date(start.getFullYear(), start.getMonth(), 1);
  });

  const shortcuts = [
    { label: 'Today', date: addDays(0) },
    { label: 'Tomorrow', date: addDays(1) },
    { label: 'This Friday', date: nextWeekday(5) },
    { label: 'Next week', date: addDays(7) },
  ];

  const firstWeekday = month.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const today = toIsoDate(addDays(0));

  // Leading blanks so the first of the month lands under its weekday.
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  function shiftMonth(by: number) {
    haptic('light');
    setMonth(new Date(month.getFullYear(), month.getMonth() + by, 1));
  }

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: t.scrim }} onPress={onClose} />

      <View
        style={[
          {
            backgroundColor: t.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            padding: space.xl,
            paddingBottom: space.xxxl,
            gap: space.lg,
          },
          elevation(3, isDark),
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[typeScale.heading, { color: t.text }]}>Tour date</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
            <Ionicons name="close" size={24} color={t.textMuted} />
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          {shortcuts.map((shortcut) => {
            const iso = toIsoDate(shortcut.date);
            const active = iso === value;
            return (
              <Touchable
                key={shortcut.label}
                onPress={() => onPick(iso)}
                scaleTo={0.94}
                style={{
                  paddingHorizontal: space.lg,
                  paddingVertical: space.sm + 2,
                  borderRadius: radius.pill,
                  backgroundColor: active ? t.primary : t.primarySoft,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '700',
                    color: active ? t.onPrimary : t.primary,
                  }}
                >
                  {shortcut.label}
                </Text>
              </Touchable>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={() => shiftMonth(-1)} hitSlop={14} accessibilityLabel="Previous month">
            <Ionicons name="chevron-back" size={22} color={t.primary} />
          </Pressable>
          <Text style={[typeScale.bodyStrong, { color: t.text }]}>
            {MONTHS[month.getMonth()]} {month.getFullYear()}
          </Text>
          <Pressable onPress={() => shiftMonth(1)} hitSlop={14} accessibilityLabel="Next month">
            <Ionicons name="chevron-forward" size={22} color={t.primary} />
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row' }}>
          {WEEKDAYS.map((day, index) => (
            <Text
              key={index}
              style={[typeScale.label, { flex: 1, textAlign: 'center', color: t.textFaint }]}
            >
              {day}
            </Text>
          ))}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {cells.map((day, index) => {
            if (day === null) return <View key={`blank-${index}`} style={{ width: `${100 / 7}%`, height: 44 }} />;

            const iso = toIsoDate(new Date(month.getFullYear(), month.getMonth(), day));
            const isSelected = iso === value;
            const isToday = iso === today;

            return (
              <Pressable
                key={iso}
                onPress={() => {
                  haptic('medium');
                  onPick(iso);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                style={{ width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: radius.pill,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isSelected ? t.primary : 'transparent',
                    borderWidth: isToday && !isSelected ? 1.5 : 0,
                    borderColor: t.accent,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15.5,
                      fontWeight: isSelected || isToday ? '800' : '500',
                      color: isSelected ? t.onPrimary : t.text,
                    }}
                  >
                    {day}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}
