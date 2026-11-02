import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KeyboardSafeView } from '@/components/KeyboardSafeView';
import { Button, ChipGroup, Field, SectionTitle } from '@/components/ui';
import { api } from '@/lib/api';
import { LANGUAGES } from '@/lib/config';
import { useSession } from '@/lib/session';
import { colors, spacing } from '@/lib/theme';

export function Onboarding() {
  const { save } = useSession();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [language, setLanguage] = useState('en');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (phone.trim().length < 6) {
      setError('Enter a valid phone number');
      return;
    }
    setSaving(true);
    await save({ phone: phone.trim(), name: name.trim(), location: location.trim(), language });
    // The backend also creates the farmer on first use, so a failure here is not fatal.
    api.registerFarmer().catch(() => {});
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardSafeView>
        <ScrollView contentContainerStyle={st.container} keyboardShouldPersistTaps="handled">
          <Ionicons name="leaf" size={64} color={colors.primary} style={{ alignSelf: 'center' }} />
          <Text style={st.title}>AgriBot</Text>
          <Text style={st.subtitle}>Your farming assistant in your language</Text>

          <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
            <Field
              label="Phone number"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(t) => {
                setPhone(t);
                setError(null);
              }}
              error={error}
            />
            <Field label="Name" value={name} onChangeText={setName} />
            <Field label="Village / District" value={location} onChangeText={setLocation} />
          </View>

          <SectionTitle>Preferred language</SectionTitle>
          <ChipGroup options={Object.keys(LANGUAGES)} value={language} onChange={setLanguage} labels={LANGUAGES} />

          <Button title="Continue" onPress={submit} loading={saving} style={{ marginTop: spacing.xl }} />
        </ScrollView>
      </KeyboardSafeView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { padding: spacing.xl, paddingTop: 48 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center', color: colors.text, marginTop: spacing.sm },
  subtitle: { fontSize: 15, textAlign: 'center', color: colors.muted, marginTop: 4 },
});
