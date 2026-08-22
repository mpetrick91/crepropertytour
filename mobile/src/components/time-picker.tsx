import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { formatClock } from '@/lib/schedule';
import { elevation, radius, space, type as typeScale, useIsDark, useTheme } from '@/lib/theme';

import { haptic, Touchable } from './ui';

/**
 * Setting when a stop happens and how long it takes.
 *
 * A wheel picker is the platform's answer and the wrong one here: tour times
 * land on quarter hours, and spinning to 9:37 is a way of getting it wrong.
 * A list of quarter hours and a row of durations is faster and cannot produce
 * a time nobody meant.
 */

const FIRST_HOUR = 7;
const LAST_HOUR = 19;
const DURATIONS = [15, 20, 30, 45, 60, 90];

function quarterHours(): Date[] {
  const slots: Date[] = [];
  for (let hour = FIRST_HOUR; hour <= LAST_HOUR; hour += 1) {
    for (const minute of [0, 15, 30, 45]) {
      const date = new Date();
      date.setHours(hour, minute, 0, 0);
      slots.push(date);
    }
  }
  return slots;
}

export function StopTimeSheet({
  open,
  onClose,
  onSave,
  onClear,
  arrival,
  minutes,
  pinned,
  label,
}: {
  open: boolean;
  onClose: () => void;
  /** Hour and minute of the chosen slot, plus the stop's duration. */
  onSave: (time: { hours: number; minutes: number }, duration: number) => void;
  /** Drops the fixed time so the stop follows the running order again. */
  onClear: () => void;
  arrival: Date | null;
  minutes: number;
  pinned: boolean;
  label: string;
}) {
  const t = useTheme();
  const isDark = useIsDark();

  const [duration, setDuration] = useState(minutes);
  const [chosen, setChosen] = useState<{ hours: number; minutes: number } | null>(
    arrival ? { hours: arrival.getHours(), minutes: arrival.getMinutes() } : null,
  );

  const slots = quarterHours();

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
            maxHeight: '78%',
          },
          elevation(3, isDark),
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={[typeScale.heading, { color: t.text }]}>Stop time</Text>
            <Text style={[typeScale.caption, { color: t.textFaint }]} numberOfLines={1}>
              {label}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
            <Ionicons name="close" size={24} color={t.textMuted} />
          </Pressable>
        </View>

        <View style={{ gap: space.sm }}>
          <Text style={[typeScale.label, { color: t.textFaint }]}>HOW LONG</Text>
          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
            {DURATIONS.map((option) => {
              const active = option === duration;
              return (
                <Touchable
                  key={option}
                  onPress={() => setDuration(option)}
                  scaleTo={0.94}
                  style={{
                    paddingHorizontal: space.lg,
                    paddingVertical: space.sm + 2,
                    borderRadius: radius.pill,
                    backgroundColor: active ? t.primary : t.surfaceSunken,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '700',
                      color: active ? t.onPrimary : t.textMuted,
                    }}
                  >
                    {option} min
                  </Text>
                </Touchable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: space.sm, flex: 1 }}>
          <Text style={[typeScale.label, { color: t.textFaint }]}>ARRIVE AT</Text>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}
          >
            {slots.map((slot) => {
              const active =
                chosen?.hours === slot.getHours() && chosen?.minutes === slot.getMinutes();
              return (
                <Touchable
                  key={slot.toISOString()}
                  onPress={() => {
                    haptic('light');
                    setChosen({ hours: slot.getHours(), minutes: slot.getMinutes() });
                  }}
                  scaleTo={0.94}
                  style={{
                    paddingHorizontal: space.md,
                    paddingVertical: space.sm,
                    borderRadius: radius.sm,
                    minWidth: 84,
                    alignItems: 'center',
                    backgroundColor: active ? t.primary : t.surfaceSunken,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: active ? '800' : '600',
                      color: active ? t.onPrimary : t.text,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {formatClock(slot)}
                  </Text>
                </Touchable>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {pinned ? (
            <Touchable
              onPress={onClear}
              scaleTo={0.96}
              style={{
                paddingHorizontal: space.lg,
                paddingVertical: space.md,
                borderRadius: radius.md,
                backgroundColor: t.surfaceSunken,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: t.textMuted }}>Unpin</Text>
            </Touchable>
          ) : null}

          <Touchable
            onPress={() => chosen && onSave(chosen, duration)}
            disabled={!chosen}
            haptic="medium"
            scaleTo={0.97}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: space.md,
              borderRadius: radius.md,
              backgroundColor: t.primary,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: t.onPrimary }}>
              {chosen ? `Fix at ${formatClock(new Date(new Date().setHours(chosen.hours, chosen.minutes)))}` : 'Pick a time'}
            </Text>
          </Touchable>
        </View>
      </View>
    </Modal>
  );
}
