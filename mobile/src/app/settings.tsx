import { router } from 'expo-router';
import { ScrollView, Text } from 'react-native';

import { Button, Card, ChipGroup } from '@/components/ui';
import { API_BASE_URL, LANGUAGES } from '@/lib/config';
import { useSession } from '@/lib/session';
import { colors, spacing } from '@/lib/theme';

export default function Settings() {
  const { profile, setLanguage, logout } = useSession();
  if (!profile) return null;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
      <Card title="Profile">
        <Text style={{ color: colors.text }}>{profile.name || 'Farmer'}</Text>
        <Text style={{ color: colors.muted }}>{profile.phone}</Text>
        {profile.location ? <Text style={{ color: colors.muted }}>{profile.location}</Text> : null}
      </Card>

      <Card title="Reply language" subtitle="AgriBot answers chat, voice and disease questions in this language">
        <ChipGroup options={Object.keys(LANGUAGES)} value={profile.language} onChange={setLanguage} labels={LANGUAGES} />
      </Card>

      <Card title="Server">
        <Text style={{ color: colors.muted, fontSize: 12 }}>{API_BASE_URL}</Text>
      </Card>

      <Button
        title="Log out"
        variant="outline"
        onPress={() => {
          if (router.canGoBack()) router.back();
          logout();
        }}
      />
    </ScrollView>
  );
}
