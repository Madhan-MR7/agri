import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Tabs } from 'expo-router';
import { Pressable, type ColorValue } from 'react-native';

import { colors } from '@/lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const tab = (title: string, icon: IconName, headerTitle = title) => ({
  title,
  headerTitle,
  tabBarIcon: ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={icon} size={size} color={color as string} />
  ),
});

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerTintColor: colors.primaryDark,
        sceneStyle: { backgroundColor: colors.background },
        headerRight: () => (
          <Pressable onPress={() => router.push('/settings')} hitSlop={12} style={{ marginRight: 16 }}>
            <Ionicons name="settings-outline" size={22} color={colors.primaryDark} />
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen name="index" options={tab('Dashboard', 'grid-outline', 'Crop Dashboard')} />
      <Tabs.Screen name="chat" options={tab('Ask', 'chatbubbles-outline', 'Ask AgriBot')} />
      <Tabs.Screen name="disease" options={tab('Disease', 'camera-outline', 'Disease Check')} />
      <Tabs.Screen name="recommend" options={tab('Recommend', 'leaf-outline', 'Recommend Crop')} />
    </Tabs>
  );
}
