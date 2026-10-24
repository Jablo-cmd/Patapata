import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Tabs } from 'expo-router/tabs';
import type { ComponentProps } from 'react';
import { View, type ColorValue } from 'react-native';

import { useBadges } from '@/lib/hooks';
import { useTheme } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export default function TabsLayout() {
  const { colors } = useTheme();
  const { unreadMessages } = useBadges();

  const icon = (name: IconName, focusedName: IconName) =>
    function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
      return <Ionicons name={focused ? focusedName : name} size={24} color={color as string} />;
    };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.tabBar, borderTopColor: colors.border, minHeight: 60 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarLabelPosition: 'below-icon',
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover', tabBarIcon: icon('compass-outline', 'compass') }} />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          tabBarAccessibilityLabel: 'Create a post',
          tabBarIcon: () => (
            <View
              style={{
                width: 44,
                height: 32,
                borderRadius: 12,
                backgroundColor: colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name="add" size={26} color="#0B1F3A" />
            </View>
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push('/compose');
          },
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: icon('chatbubbles-outline', 'chatbubbles'),
          tabBarBadge: unreadMessages > 0 ? unreadMessages : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.accent, color: '#0B1F3A', fontWeight: '800' },
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-circle-outline', 'person-circle') }} />
    </Tabs>
  );
}
