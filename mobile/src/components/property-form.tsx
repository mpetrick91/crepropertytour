import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { Button, ErrorText, Field, Muted, SectionLabel, Title } from '@/components/ui';
import { spacing } from '@/lib/theme';
import type { Property, PropertyInsert } from '@/lib/types';

/** Blank string means "not filled in", which has to become null, not 0 or ''. */
const asText = (value: string) => (value.trim() === '' ? null : value.trim());
const asInt = (value: string) => {
  const parsed = Number.parseInt(value.replace(/[,\s]/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : null;
};
const asDecimal = (value: string) => {
  const parsed = Number.parseFloat(value.replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};
const str = (value: unknown) => (value == null ? '' : String(value));

export type PropertyDraft = Omit<PropertyInsert, 'broker_id'>;

export function PropertyForm({
  property,
  submitLabel,
  busy,
  error,
  onSubmit,
  footer,
}: {
  property?: Property;
  submitLabel: string;
  busy: boolean;
  error: string | null;
  onSubmit: (draft: PropertyDraft) => void;
  footer?: React.ReactNode;
}) {
  const [name, setName] = useState(str(property?.name));
  const [address, setAddress] = useState(str(property?.address_line1));
  const [city, setCity] = useState(str(property?.city));
  const [state, setState] = useState(str(property?.state));
  const [buildingSf, setBuildingSf] = useState(str(property?.building_size_sf));
  const [availableSf, setAvailableSf] = useState(str(property?.available_sf));
  const [clearHeight, setClearHeight] = useState(str(property?.clear_height_ft));
  const [docks, setDocks] = useState(str(property?.dock_doors));
  const [rate, setRate] = useState(str(property?.rent_rate));
  const [opEx, setOpEx] = useState(str(property?.op_ex));
  const [description, setDescription] = useState(str(property?.description));
  const [notes, setNotes] = useState(str(property?.notes));

  function submit() {
    if (!address.trim()) return;
    onSubmit({
      name: asText(name),
      address_line1: address.trim(),
      city: asText(city),
      state: asText(state),
      property_type: property?.property_type ?? 'industrial',
      building_size_sf: asInt(buildingSf),
      available_sf: asInt(availableSf),
      clear_height_ft: asDecimal(clearHeight),
      dock_doors: asInt(docks),
      rent_rate: asDecimal(rate),
      rent_type: property?.rent_type ?? 'nnn',
      op_ex: asDecimal(opEx),
      description: asText(description),
      notes: asText(notes),
    });
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
        <Title>{property ? 'Edit property' : 'Add property'}</Title>
        <Muted>Only the street address is required. Fill in the rest as it&apos;s confirmed.</Muted>

        <SectionLabel>Location</SectionLabel>
        <Field label="Building name" value={name} onChangeText={setName} autoCapitalize="words" />
        <Field
          label="Street address"
          value={address}
          onChangeText={setAddress}
          autoCapitalize="words"
          placeholder="4600 Fisher Rd"
        />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 2 }}>
            <Field label="City" value={city} onChangeText={setCity} autoCapitalize="words" />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="State"
              value={state}
              onChangeText={setState}
              autoCapitalize="characters"
              maxLength={2}
            />
          </View>
        </View>

        <SectionLabel>Building</SectionLabel>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Field
              label="Building SF"
              value={buildingSf}
              onChangeText={setBuildingSf}
              keyboardType="number-pad"
              inputMode="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Available SF"
              value={availableSf}
              onChangeText={setAvailableSf}
              keyboardType="number-pad"
              inputMode="numeric"
            />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Field
              label="Clear height (ft)"
              value={clearHeight}
              onChangeText={setClearHeight}
              keyboardType="decimal-pad"
              inputMode="decimal"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Dock doors"
              value={docks}
              onChangeText={setDocks}
              keyboardType="number-pad"
              inputMode="numeric"
            />
          </View>
        </View>

        <SectionLabel>Economics</SectionLabel>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Field
              label="Rate $/SF NNN"
              value={rate}
              onChangeText={setRate}
              keyboardType="decimal-pad"
              inputMode="decimal"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="OpEx $/SF"
              value={opEx}
              onChangeText={setOpEx}
              keyboardType="decimal-pad"
              inputMode="decimal"
            />
          </View>
        </View>

        <SectionLabel>Notes</SectionLabel>
        <Field
          label="Client-facing description"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          style={{ minHeight: 84, textAlignVertical: 'top' }}
          hint="Shown to the client on the tour."
        />
        <Field
          label="Internal notes"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          internal
          style={{ minHeight: 84, textAlignVertical: 'top' }}
          hint="Never shown to a client. Negotiating position, landlord read, whatever you need."
        />

        <ErrorText>{error}</ErrorText>
        <Button title={submitLabel} onPress={submit} busy={busy} disabled={!address.trim()} />
        {footer}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
