import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Onboarding } from '@/components/Onboarding';
import { SessionProvider, useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

function Root() {
  const { ready, profile } = useSession();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!profile) return <Onboarding />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.primaryDark,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="result" options={{ title: 'Recommendation' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings', presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <Root />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
