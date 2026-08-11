import { Link, Redirect } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Muted, Title } from '@/components/ui';
import { useSession } from '@/lib/session';
import { space, useTheme } from '@/lib/theme';

/**
 * Front door. A broker lands on their tours; anyone else gets the pitch and a
 * way in. Guests normally never see this screen -- they arrive on a tour link.
 */
export default function IndexScreen() {
  const { isBroker, user, loading } = useSession();
  const insets = useSafeAreaInsets();
  const t = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={t.accent} />
      </View>
    );
  }

  if (isBroker) return <Redirect href="/tours" />;

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        padding: space.xl,
        paddingTop: insets.top + space.xxl,
        paddingBottom: insets.bottom + space.xxl,
        gap: space.lg,
      }}
    >
      <Title>CRE Property Tour</Title>
      <Body style={{ color: t.textMuted }}>
        Build the itinerary, send one link, and collect every note and photo from the
        walkthrough in one place.
      </Body>

      <View style={{ gap: space.md, marginTop: space.lg }}>
        <Link href="/login" asChild>
          <Button title="Broker sign-in" onPress={() => {}} />
        </Link>
      </View>

      {user?.is_anonymous ? (
        <Muted style={{ textAlign: 'center' }}>
          You joined a tour as a guest. Reopen the link your broker sent to get back to it.
        </Muted>
      ) : (
        <Muted style={{ textAlign: 'center' }}>
          On a tour? Open the link your broker sent you and it will bring you straight here.
        </Muted>
      )}
    </ScrollView>
  );
}
