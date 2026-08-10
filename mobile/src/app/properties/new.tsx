import { useRouter } from 'expo-router';
import { useState } from 'react';

import { PropertyForm, type PropertyDraft } from '@/components/property-form';
import { humanError } from '@/lib/format';
import { supabase } from '@/lib/supabase';

export default function NewPropertyScreen() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(draft: PropertyDraft) {
    setBusy(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError('Your session expired. Sign in again.');
      setBusy(false);
      return;
    }

    const { error: insertError } = await supabase
      .from('properties')
      .insert({ ...draft, broker_id: userData.user.id });

    if (insertError) {
      setError(humanError(insertError.message));
      setBusy(false);
      return;
    }

    router.back();
  }

  return (
    <PropertyForm submitLabel="Save property" busy={busy} error={error} onSubmit={create} />
  );
}
