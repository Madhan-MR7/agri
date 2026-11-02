import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { KeyboardSafeView } from '@/components/KeyboardSafeView';
import { Button, ChipGroup, ErrorText, Field, SectionTitle } from '@/components/ui';
import { api } from '@/lib/api';
import { titleCase } from '@/lib/format';
import { setSelectedResult } from '@/lib/resultStore';
import { colors, spacing } from '@/lib/theme';

type NumField = { key: string; label: string; unit: string; min: number; max: number; initial: number };

// Ranges match the backend's CropInput validation (backend/app/schemas.py)
const SOIL_FIELDS: NumField[] = [
  { key: 'N', label: 'Nitrogen (N)', unit: 'kg/ha', min: 0, max: 200, initial: 90 },
  { key: 'P', label: 'Phosphorus (P)', unit: 'kg/ha', min: 0, max: 200, initial: 42 },
  { key: 'K', label: 'Potassium (K)', unit: 'kg/ha', min: 0, max: 250, initial: 43 },
  { key: 'ph', label: 'Soil pH', unit: '', min: 3, max: 10, initial: 6.5 },
  { key: 'soil_moisture', label: 'Soil moisture', unit: '%', min: 0, max: 100, initial: 45 },
];
const CLIMATE_FIELDS: NumField[] = [
  { key: 'temperature', label: 'Temperature', unit: '°C', min: -5, max: 55, initial: 25 },
  { key: 'humidity', label: 'Humidity', unit: '%', min: 0, max: 100, initial: 75 },
  { key: 'rainfall', label: 'Rainfall', unit: 'mm', min: 0, max: 500, initial: 150 },
];
const ALL_FIELDS = [...SOIL_FIELDS, ...CLIMATE_FIELDS];

const SOIL_TYPES = ['alluvial', 'black', 'red', 'laterite', 'sandy', 'loamy', 'clayey'] as const;
const WATER_LEVELS = ['low', 'medium', 'high'] as const;

const validate = (f: NumField, raw: string) => {
  const n = Number(raw);
  if (raw.trim() === '' || Number.isNaN(n)) return 'Enter a number';
  if (n < f.min || n > f.max) return `Must be ${f.min}–${f.max}`;
  return null;
};

export default function RecommendScreen() {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(ALL_FIELDS.map((f) => [f.key, String(f.initial)])),
  );
  const [soil, setSoil] = useState<(typeof SOIL_TYPES)[number]>('alluvial');
  const [water, setWater] = useState<(typeof WATER_LEVELS)[number]>('medium');
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors = Object.fromEntries(ALL_FIELDS.map((f) => [f.key, validate(f, values[f.key])]));
  const hasErrors = Object.values(errors).some(Boolean);

  const submit = async () => {
    setShowErrors(true);
    if (hasErrors) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.recommendCrop({
        ...Object.fromEntries(ALL_FIELDS.map((f) => [f.key, Number(values[f.key])])),
        soil_type: soil,
        water_availability: water,
      });
      setSelectedResult(result);
      router.push('/result');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const grid = (fields: NumField[]) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
      {fields.map((f) => (
        <View key={f.key} style={{ width: '47%' }}>
          <Field
            label={f.label}
            suffix={f.unit}
            keyboardType="decimal-pad"
            value={values[f.key]}
            onChangeText={(t) => setValues((v) => ({ ...v, [f.key]: t }))}
            error={showErrors ? errors[f.key] : null}
            hint={`${f.min} – ${f.max}`}
          />
        </View>
      ))}
    </View>
  );

  return (
    <KeyboardSafeView>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: colors.muted }}>
          Enter your soil test and field conditions. The model suggests the best crops and explains which factors
          influenced the choice.
        </Text>

        <SectionTitle>Soil nutrients & condition</SectionTitle>
        {grid(SOIL_FIELDS)}

        <SectionTitle>Climate</SectionTitle>
        {grid(CLIMATE_FIELDS)}

        <SectionTitle>Soil / land type</SectionTitle>
        <ChipGroup
          options={SOIL_TYPES}
          value={soil}
          onChange={setSoil}
          labels={Object.fromEntries(SOIL_TYPES.map((s) => [s, titleCase(s)]))}
        />

        <SectionTitle>Water availability</SectionTitle>
        <ChipGroup
          options={WATER_LEVELS}
          value={water}
          onChange={setWater}
          labels={Object.fromEntries(WATER_LEVELS.map((s) => [s, titleCase(s)]))}
        />

        <Button
          title={busy ? 'Analyzing…' : 'Recommend crop'}
          onPress={submit}
          loading={busy}
          icon={<Ionicons name="sparkles" size={18} color="#fff" />}
          style={{ marginTop: spacing.xl }}
        />
        {error ? <ErrorText>{error}</ErrorText> : null}
      </ScrollView>
    </KeyboardSafeView>
  );
}
