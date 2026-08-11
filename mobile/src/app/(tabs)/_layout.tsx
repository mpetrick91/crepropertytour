import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, Platform, View } from 'react-native';

import { useSession } from '@/lib/session';
import { radius, useTheme } from '@/lib/theme';

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
        tabBarStyle: {
          backgroundColor: t.surface,
          borderTopColor: t.border,
          borderTopWidth: 0,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingTop: 8,
          // Lifts the bar off the canvas so the list scrolls *under* something,
          // rather than ending at a flat line.
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: -4 },
          elevation: 12,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          position: 'absolute',
        },
        tabBarLabelStyle: { fontSize: 11.5, fontWeight: '700', marginTop: 2 },
        tabBarItemStyle: { paddingVertical: 4 },
      }}
    >
      <Tabs.Screen
        name="tours"
        options={{
          title: 'Tours',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'map' : 'map-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="properties"
        options={{
          title: 'Buildings',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'business' : 'business-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
