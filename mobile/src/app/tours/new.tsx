import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DateField } from '@/components/date-picker';
import { ScreenHeader } from '@/components/screen';
import { Appear, Button, Caption, ErrorText, Field, Touchable } from '@/components/ui';
import { humanError } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { elevation, radius, space, useIsDark, useTheme } from '@/lib/theme';

/**
 * Creating a tour.
 *
 * The previous version was seven boxes stacked in a column, which is a form,
 * not a screen -- and it read as one. The fields are the same; what changed is
 * that they are grouped into the three questions a broker is actually
 * answering, each with its own card and heading, so the screen can be
 * understood before it is filled in. Only the name is required, and the button
 * says so rather than sitting greyed out with no explanation.
 */

/** Groups of fields, as questions rather than database columns. */
function Section({
  icon,
  title,
  hint,
  index,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint?: string;
  index: number;
  children: React.ReactNode;
}) {
  const t = useTheme();
  const isDark = useIsDark();

  return (
    <Appear index={index}>
      <View
        style={[
          {
            backgroundColor: t.surface,
            borderRadius: radius.lg,
            padding: space.lg,
            gap: space.lg,
          },
          elevation(1, isDark),
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: radius.sm,
              backgroundColor: t.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={icon} size={18} color={t.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: t.text }}>{title}</Text>
            {hint ? <Caption>{hint}</Caption> : null}
          </View>
        </View>

        {children}
      </View>
    </Appear>
  );
}

export default function NewTourScreen() {
  const router = useRouter();
  const t = useTheme();
  const isDark = useIsDark();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientCompany, setClientCompany] = useState('');
  const [market, setMarket] = useState('');
  const [tourDate, setTourDate] = useState('');
  const [requirement, setRequirement] = useState('');
  const [notes, setNotes] = useState('');

  const [brokerId, setBrokerId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setBrokerId(data.user?.id ?? null));
  }, []);

  /**
   * Most tours are called "<company> — <market>", so offer that rather than
   * making someone type what the screen already knows.
   */
  const suggestion =
    clientCompany.trim() && market.trim()
      ? `${clientCompany.trim()} — ${market.trim()}`
      : clientCompany.trim() || null;

  async function create() {
    if (!title.trim() || !brokerId) return;
    setBusy(true);
    setError(null);

    try {
      let clientId: string | null = null;
      if (clientName.trim() || clientCompany.trim()) {
        const { data, error: clientError } = await supabase
          .from('clients')
          .insert({
            broker_id: brokerId,
            name: clientName.trim() || clientCompany.trim(),
            company: clientCompany.trim() || null,
          })
          .select('id')
          .single();
        if (clientError) throw clientError;
        clientId = data.id;
      }

      const { data, error: tourError } = await supabase
        .from('tours')
        .insert({
          broker_id: brokerId,
          client_id: clientId,
          title: title.trim(),
          status: 'draft',
          // A bare date column; an empty box has to become null, not ''.
          tour_date: tourDate.trim() || null,
          market: market.trim() || null,
          requirement_summary: requirement.trim() || null,
          notes: notes.trim() || null,
        })
        .select('id')
        .single();
      if (tourError) throw tourError;

      router.replace(`/tours/${data.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? humanError(caught.message) : 'Could not create the tour.');
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.canvas }}>
      <ScreenHeader title="New tour" subtitle="Buildings come next" back compact />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            padding: space.lg,
            gap: space.lg,
            // Clear of the button pinned to the bottom.
            paddingBottom: insets.bottom + 108,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Section icon="people-outline" title="Who is it for?" index={0}>
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Company"
                  value={clientCompany}
                  onChangeText={setClientCompany}
                  placeholder="Ridgeline"
                  autoCapitalize="words"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="Contact"
                  value={clientName}
                  onChangeText={setClientName}
                  placeholder="Jane Doe"
                  autoCapitalize="words"
                />
              </View>
            </View>
          </Section>

          <Section icon="calendar-outline" title="When and where?" index={1}>
            <DateField label="Date" value={tourDate} onChange={setTourDate} />
            <Field
              label="Market"
              value={market}
              onChangeText={setMarket}
              placeholder="Grand Rapids, MI"
              autoCapitalize="words"
              icon="location-outline"
            />
          </Section>

          <Section
            icon="bookmark-outline"
            title="Name the tour"
            hint="What you'll see on your board"
            index={2}
          >
            <Field
              label="Tour name"
              value={title}
              onChangeText={setTitle}
              placeholder="Ridgeline — Grand Rapids"
              autoCapitalize="words"
            />

            {/* Offered, not imposed: one tap fills it, and it disappears once
                the name matches. */}
            {suggestion && suggestion !== title.trim() ? (
              <Touchable
                onPress={() => setTitle(suggestion)}
                scaleTo={0.96}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.sm,
                  alignSelf: 'flex-start',
                  backgroundColor: t.accentSoft,
                  borderRadius: radius.pill,
                  paddingHorizontal: space.md,
                  paddingVertical: space.sm,
                }}
              >
                <Ionicons name="sparkles" size={13} color={t.accentInk} />
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: t.accentInk }}>
                  Use “{suggestion}”
                </Text>
              </Touchable>
            ) : null}
          </Section>

          <Section
            icon="document-text-outline"
            title="What are they looking for?"
            hint="Optional"
            index={3}
          >
            <Field
              label="Requirement"
              value={requirement}
              onChangeText={setRequirement}
              placeholder="45,000–65,000 SF, 28′ clear, occupancy by Q2."
              multiline
              numberOfLines={3}
              style={{ minHeight: 76, textAlignVertical: 'top' }}
              hint="Your client sees this on the tour."
            />
            <Field
              label="Internal notes"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
              internal
              style={{ minHeight: 68, textAlignVertical: 'top' }}
              hint="Never shown to the client."
            />
          </Section>

          <ErrorText>{error}</ErrorText>
        </ScrollView>

        {/* Pinned, so the way forward is visible from the first field rather
            than at the end of a scroll. */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: space.lg,
            paddingTop: space.md,
            paddingBottom: insets.bottom + space.md,
            backgroundColor: t.surface,
            borderTopWidth: 1,
            borderTopColor: t.border,
            gap: space.xs,
          }}
        >
          <Button
            title="Create tour"
            icon="arrow-forward"
            onPress={create}
            busy={busy}
            disabled={!title.trim()}
          />
          {!title.trim() ? (
            <Caption style={{ textAlign: 'center' }}>Give the tour a name to continue.</Caption>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
