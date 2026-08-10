import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { Button, ErrorText, Field, Muted, Title } from '@/components/ui';
import { humanError } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { spacing } from '@/lib/theme';

export default function NewTourScreen() {
  const router = useRouter();

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

  async function create() {
    if (!title.trim() || !brokerId) return;
    setBusy(true);
    setError(null);

    try {
      let clientId: string | null = null;
      if (clientName.trim()) {
        const { data, error: clientError } = await supabase
          .from('clients')
          .insert({
            broker_id: brokerId,
            name: clientName.trim(),
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
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        <Title>New tour</Title>
        <Muted>Name it now and add buildings next.</Muted>

        <Field
          label="Tour name"
          value={title}
          onChangeText={setTitle}
          placeholder="Acme Logistics — Columbus West"
          autoCapitalize="words"
        />

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Field
              label="Client contact"
              value={clientName}
              onChangeText={setClientName}
              placeholder="Jane Doe"
              autoCapitalize="words"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Company"
              value={clientCompany}
              onChangeText={setClientCompany}
              placeholder="Acme"
              autoCapitalize="words"
            />
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Field
              label="Date"
              value={tourDate}
              onChangeText={setTourDate}
              placeholder="2026-08-14"
              autoCapitalize="none"
              autoCorrect={false}
              hint="YYYY-MM-DD"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Market"
              value={market}
              onChangeText={setMarket}
              placeholder="Columbus, OH"
              autoCapitalize="words"
            />
          </View>
        </View>

        <Field
          label="Requirement"
          value={requirement}
          onChangeText={setRequirement}
          placeholder="75,000–100,000 SF, 28 ft clear minimum, Q1 occupancy."
          multiline
          numberOfLines={2}
          style={{ minHeight: 72, textAlignVertical: 'top' }}
          hint="Shown to the client on the tour."
        />

        <Field
          label="Internal notes"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={2}
          internal
          style={{ minHeight: 72, textAlignVertical: 'top' }}
          hint="Never shown to the client."
        />

        <ErrorText>{error}</ErrorText>
        <Button title="Create tour" onPress={create} busy={busy} disabled={!title.trim()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
