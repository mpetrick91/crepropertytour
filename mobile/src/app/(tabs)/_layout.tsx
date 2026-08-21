import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, Platform, View } from 'react-native';

import { useSession } from '@/lib/session';
import { radius, space, useTheme } from '@/lib/theme';

/**
 * A bottom tab bar is most of what makes this read as an app rather than a
 * website: the two places a broker actually lives are always one thumb-reach
 * away, and neither is ever more than one tap from the other.
 */
export default function TabsLayout() {
  const { isBroker, loading } = useSession();
  const t = useTheme();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: t.canvas,
        }}
      >
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }

  if (!isBroker) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.textFaint,
        // A bar that floats clear of the edges, rather than a strip welded to
        // the bottom of the screen. The content scrolling visibly underneath
        // it is most of what separates "an app" from "a page with links".
        tabBarStyle: {
          position: 'absolute',
          left: space.lg,
          right: space.lg,
          bottom: Platform.OS === 'ios' ? 28 : space.lg,
          height: 78,
          paddingTop: 9,
          paddingBottom: 11,
          backgroundColor: t.surface,
          borderTopWidth: 0,
          borderRadius: radius.pill,
          shadowColor: '#000',
          shadowOpacity: 0.14,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 8 },
          elevation: 16,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 1 },
        tabBarItemStyle: { paddingVertical: 4, borderRadius: radius.pill },
      }}
    >
      <Tabs.Screen
        name="tours"
        options={{
          title: 'Tours',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="map" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="properties"
        options={{
          title: 'Buildings',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="business" focused={focused} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

/**
 * The selected tab gets a filled capsule behind it, so which one is active is
 * legible from the shape alone rather than from a tint difference that a bright
 * sidewalk washes out.
 */
function TabIcon({
  name,
  focused,
  color,
}: {
  name: 'map' | 'business';
  focused: boolean;
  color: string;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: space.lg,
        paddingVertical: 3,
        borderRadius: radius.pill,
        backgroundColor: focused ? t.primarySoft : 'transparent',
      }}
    >
      <Ionicons name={focused ? name : `${name}-outline`} size={22} color={color} />
    </View>
  );
}
