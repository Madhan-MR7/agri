import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { ShapBarChart } from '@/components/charts';
import { Card, Chip, SectionTitle } from '@/components/ui';
import { pct, stripMarkdown, titleCase } from '@/lib/format';
import { getSelectedResult } from '@/lib/resultStore';
import { colors, spacing } from '@/lib/theme';
import type { Candidate } from '@/lib/types';

/** Shows a fresh POST /api/crop/recommend result or a stored one picked from the dashboard. */
export default function ResultScreen() {
  const [result] = useState(getSelectedResult);
  const [selected, setSelected] = useState(0);
  if (!result) return null;

  // Fresh results carry SHAP for every candidate; stored ones only for the top crop.
  const candidates: Candidate[] =
    'candidates' in result
      ? result.candidates
      : result.top_crops.map((c, i) => ({ ...c, contributions: i === 0 ? result.shap_values : undefined }));
  const current = candidates[selected];

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48 }}>
      <Card style={{ backgroundColor: colors.primaryLight, alignItems: 'center' }}>
        <Ionicons name="leaf" size={44} color={colors.primary} />
        <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text }}>{titleCase(result.recommended_crop)}</Text>
        <Text style={{ color: colors.muted }}>{pct(result.confidence)} confidence</Text>
      </Card>

      <SectionTitle>Why this crop?</SectionTitle>
      <Text style={{ color: colors.text, lineHeight: 21 }}>{stripMarkdown(result.explanation)}</Text>

      <SectionTitle>Top options</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {candidates.map((c, i) => (
          <Chip
            key={c.crop}
            label={`${titleCase(c.crop)} ${pct(c.probability)}`}
            selected={i === selected}
            onPress={c.contributions ? () => setSelected(i) : undefined}
          />
        ))}
      </View>

      <SectionTitle>Factor impact for {titleCase(current.crop)}</SectionTitle>
      <Text style={{ color: colors.muted, fontSize: 12, marginBottom: spacing.md }}>
        SHAP values: how much each soil and climate factor pushed the model towards or away from this crop.
      </Text>
      {current.contributions ? (
        <Card>
          <ShapBarChart contributions={current.contributions} />
        </Card>
      ) : null}
    </ScrollView>
  );
}
