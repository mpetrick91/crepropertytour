import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

import { PropertyForm, type PropertyDraft } from '@/components/property-form';
import { Button, Muted, Title } from '@/components/ui';
import { humanError } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { space, useTheme } from '@/lib/theme';
import type { Property } from '@/lib/types';

export default function EditPropertyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTheme();

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('properties')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        setProperty(data ?? null);
        setLoading(false);
      });
  }, [id]);

  async function save(draft: PropertyDraft) {
    if (!id) return;
    setBusy(true);
    setError(null);

    // No broker filter needed -- row-level security already scopes this to
    // properties this account owns.
    const { error: updateError } = await supabase.from('properties').update(draft).eq('id', id);

    if (updateError) {
      setError(humanError(updateError.message));
      setBusy(false);
      return;
    }
    router.back();
  }

  function confirmDelete() {
    Alert.alert('Delete this property?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error: deleteError } = await supabase.from('properties').delete().eq('id', id);
          if (deleteError) {
            // ON DELETE RESTRICT protects a property that is on a tour.
            setError(
              /violates foreign key|restrict/i.test(deleteError.message)
                ? 'This property is on a tour. Remove it from the itinerary first.'
                : humanError(deleteError.message),
            );
          } else {
            router.back();
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={t.accent} />
      </View>
    );
  }

  if (!property) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: space.xl }}>
        <Title>Property not found</Title>
      </View>
    );
  }

  return (
    <PropertyForm
      property={property}
      submitLabel="Save changes"
      busy={busy}
      error={error}
      onSubmit={save}
      footer={
        <View style={{ gap: space.sm, marginTop: space.xl }}>
          <Button title="Delete property" variant="danger" onPress={confirmDelete} />
          <Muted style={{ textAlign: 'center' }}>
            Blocked while the property is on a tour.
          </Muted>
        </View>
      }
    />
  );
}
