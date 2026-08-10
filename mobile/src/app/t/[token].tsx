import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StopCard } from '@/components/stop-card';
import { Body, Button, ErrorText, Field, Muted, SectionLabel, Title } from '@/components/ui';
import { formatTourDate, humanError } from '@/lib/format';
import { signedPhotoUrls } from '@/lib/photos';
import { supabase } from '@/lib/supabase';
import { spacing, useTheme } from '@/lib/theme';
import {
  type GuestProperty,
  type GuestTour,
  type GuestTourStop,
  type TourSharePreview,
} from '@/lib/types';

type NoteRow = {
  id: string;
  stop_id: string;
  body: string;
  rating: number | null;
  participant_id: string;
  tour_participants: { display_name: string } | { display_name: string }[] | null;
};

type PhotoRow = {
  id: string;
  stop_id: string;
  storage_path: string;
  caption: string | null;
  participant_id: string;
};

type Participation = {
  id: string;
  can_add_notes: boolean;
  can_add_photos: boolean;
};

const INVALID_COPY: Record<string, string> = {
  not_found: "We couldn't find this tour. Check the link, or ask your broker to resend it.",
  revoked: 'This tour link has been turned off. Ask your broker for a new one.',
  expired: 'This tour link has expired. Ask your broker for a new one.',
};

export default function GuestTourScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const t = useTheme();

  const [preview, setPreview] = useState<TourSharePreview | null>(null);
  const [participation, setParticipation] = useState<Participation | null>(null);
  const [tour, setTour] = useState<GuestTour | null>(null);
  const [stops, setStops] = useState<GuestTourStop[]>([]);
  const [properties, setProperties] = useState<Map<string, GuestProperty>>(new Map());
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map());

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Everything a participant is allowed to read, in one pass. */
  const loadTour = useCallback(async (tourId: string) => {
    const [{ data: tourRow }, { data: stopRows }, { data: noteRows }, { data: photoRows }] =
      await Promise.all([
        supabase
          .from('guest_tours')
          .select('id, title, status, tour_date, start_time, market, requirement_summary')
          .eq('id', tourId)
          .maybeSingle(),
        supabase
          .from('guest_tour_stops')
          .select('id, tour_id, property_id, position, scheduled_at, duration_minutes, visited_at')
          .eq('tour_id', tourId)
          .order('position'),
        supabase
          .from('stop_notes')
          .select('id, stop_id, body, rating, participant_id, tour_participants(display_name)')
          .eq('tour_id', tourId)
          .order('created_at'),
        supabase
          .from('stop_photos')
          .select('id, stop_id, storage_path, caption, participant_id')
          .eq('tour_id', tourId)
          .order('created_at'),
      ]);

    setTour(tourRow ?? null);
    setStops(stopRows ?? []);
    setNotes((noteRows as NoteRow[] | null) ?? []);
    setPhotos((photoRows as PhotoRow[] | null) ?? []);

    const propertyIds = (stopRows ?? []).map((s) => s.property_id);
    if (propertyIds.length) {
      const { data: propertyRows } = await supabase
        .from('guest_properties')
        .select('*')
        .in('id', propertyIds);
      setProperties(new Map((propertyRows ?? []).map((p) => [p.id, p])));
    }

    // The bucket is private, so images come back as short-lived signed links.
    setPhotoUrls(await signedPhotoUrls((photoRows ?? []).map((p) => p.storage_path)));
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    setError(null);

    const { data, error: previewError } = await supabase.rpc('preview_tour_share', {
      p_token: token,
    });
    const share = data as TourSharePreview | null;
    setPreview(share);

    if (previewError || !share?.valid || !share.tour_id) {
      setLoading(false);
      return;
    }

    navigation.setOptions({ title: share.tour_title ?? 'Tour' });

    // A participant row is the proof of access -- the guest views return
    // nothing without one.
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data: participant } = await supabase
        .from('tour_participants')
        .select('id, can_add_notes, can_add_photos')
        .eq('tour_id', share.tour_id)
        .eq('user_id', userData.user.id)
        .is('removed_at', null)
        .maybeSingle();

      if (participant) {
        setParticipation(participant);
        await loadTour(share.tour_id);
      }
    }

    setLoading(false);
  }, [token, loadTour, navigation]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function join() {
    if (!token || !name.trim()) return;
    setJoining(true);
    setError(null);

    try {
      // No account, no password: the guest gets an anonymous identity, then
      // trades the link token for a seat on this one tour. After that they are
      // an ordinary authenticated user and row-level security does the rest.
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        const { error: authError } = await supabase.auth.signInAnonymously();
        if (authError) throw authError;
      }

      const { error: joinError } = await supabase.rpc('join_tour', {
        p_token: token,
        p_display_name: name.trim(),
        p_company: company.trim() || null,
      });
      if (joinError) throw joinError;

      // Email is optional and stored on the guest's own participant row, so the
      // broker knows who left which note without the client making an account.
      if (email.trim()) {
        await supabase.auth.updateUser({ email: email.trim() }).catch(() => {});
      }

      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? humanError(caught.message) : 'Something went wrong.');
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={t.accent} />
      </View>
    );
  }

  if (!preview?.valid || !preview.tour_id) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md }}>
        <Title>Tour unavailable</Title>
        <Body style={{ color: t.textMuted }}>
          {INVALID_COPY[preview?.reason ?? 'not_found'] ?? INVALID_COPY.not_found}
        </Body>
      </View>
    );
  }

  // ---- Not joined yet: the one screen a client fills in -------------------
  if (!participation) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            padding: spacing.xl,
            paddingBottom: insets.bottom + spacing.xxl,
            gap: spacing.lg,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: spacing.xs }}>
            <Muted>
              {preview.broker_name ?? 'Your broker'}
              {preview.broker_company ? ` · ${preview.broker_company}` : ''} invited you to
            </Muted>
            <Title>{preview.tour_title}</Title>
            <Muted>
              {[
                formatTourDate(preview.tour_date),
                preview.market,
                `${preview.stop_count ?? 0} buildings`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Muted>
          </View>

          <Field
            label="Your name"
            value={name}
            onChangeText={setName}
            placeholder="Jane Doe"
            autoCapitalize="words"
            autoComplete="name"
            hint="So your notes and photos are labelled for the group."
          />

          <Field
            label="Email (optional)"
            value={email}
            onChangeText={setEmail}
            placeholder="jane@company.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            inputMode="email"
            hint="Only so your broker can follow up. No password, no account."
          />

          <Field
            label="Company (optional)"
            value={company}
            onChangeText={setCompany}
            autoCapitalize="words"
            autoComplete="organization"
          />

          <ErrorText>{error}</ErrorText>

          <Button
            title="Join the tour"
            onPress={join}
            busy={joining}
            disabled={!name.trim()}
          />
          <Muted style={{ textAlign: 'center' }}>No account or password needed.</Muted>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ---- On the tour --------------------------------------------------------
  return (
    <ScrollView
      contentContainerStyle={{
        padding: spacing.lg,
        paddingBottom: insets.bottom + spacing.xxl,
        gap: spacing.lg,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ gap: spacing.xs }}>
        <Title>{tour?.title ?? preview.tour_title}</Title>
        <Muted>
          {[formatTourDate(tour?.tour_date), tour?.market].filter(Boolean).join(' · ')}
        </Muted>
      </View>

      {tour?.requirement_summary ? (
        <View style={{ backgroundColor: t.surface, borderRadius: 10, padding: spacing.lg }}>
          <Body>{tour.requirement_summary}</Body>
        </View>
      ) : null}

      <SectionLabel>Itinerary</SectionLabel>

      {stops.map((stop, index) => (
        <StopCard
          key={stop.id}
          index={index}
          tourId={stop.tour_id}
          stopId={stop.id}
          participantId={participation.id}
          canAddNotes={participation.can_add_notes}
          canAddPhotos={participation.can_add_photos}
          property={properties.get(stop.property_id) ?? null}
          notes={notes
            .filter((n) => n.stop_id === stop.id)
            .map((n) => {
              const author = Array.isArray(n.tour_participants)
                ? n.tour_participants[0]
                : n.tour_participants;
              return {
                id: n.id,
                body: n.body,
                rating: n.rating,
                authorName: author?.display_name ?? 'Someone',
                isMine: n.participant_id === participation.id,
              };
            })}
          photos={photos
            .filter((p) => p.stop_id === stop.id)
            .map((p) => ({
              id: p.id,
              url: photoUrls.get(p.storage_path) ?? null,
              caption: p.caption,
              isMine: p.participant_id === participation.id,
            }))}
          onChanged={refresh}
        />
      ))}

      {!stops.length ? (
        <Muted>Your broker hasn&apos;t added buildings to this tour yet.</Muted>
      ) : null}
    </ScrollView>
  );
}
