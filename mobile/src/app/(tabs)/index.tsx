import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ImportanceBars, LineChart, PieChart, ShapBarChart } from '@/components/charts';
import { Button, Card, ErrorText } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDate, pct, titleCase } from '@/lib/format';
import { setSelectedResult } from '@/lib/resultStore';
import { useSession } from '@/lib/session';
import { colors, spacing } from '@/lib/theme';
import type { Dashboard, StoredRecommendation } from '@/lib/types';

export default function DashboardScreen() {
  const { profile } = useSession();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await api.dashboard());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // Reload whenever the tab gains focus, e.g. after making a new recommendation
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const open = (rec: StoredRecommendation) => {
    setSelectedResult(rec);
    router.push('/result');
  };

  if (!data) {
    return (
      <View style={st.center}>
        {error ? (
          <>
            <ErrorText>{error}</ErrorText>
            <Button title="Retry" onPress={load} style={{ marginTop: spacing.lg }} />
          </>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
    );
  }

  const { stats, latest } = data;

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
    >
      <Text style={st.greeting}>Welcome, {profile?.name || 'Farmer'}</Text>
      {profile?.location ? <Text style={{ color: colors.muted }}>{profile.location}</Text> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}

      <View style={st.stats}>
        <Stat icon="leaf" label="Recommendations" value={String(stats.recommendations)} />
        <Stat icon="medkit" label="Disease checks" value={String(stats.disease_detections)} />
        <Stat icon="chatbubbles" label="Questions asked" value={String(stats.chats)} />
        <Stat icon="checkmark-done" label="Avg confidence" value={pct(stats.avg_confidence)} />
      </View>

      {!latest ? (
        <Card style={{ alignItems: 'center' }}>
          <Ionicons name="leaf-outline" size={44} color={colors.primary} />
          <Text style={{ textAlign: 'center', color: colors.text, marginVertical: spacing.md }}>
            No crop recommendations yet. Enter your soil and climate details to get one.
          </Text>
          <Button title="Get a recommendation" onPress={() => router.push('/recommend')} />
        </Card>
      ) : (
        <>
          <Card title="Latest recommendation">
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ flex: 1, fontSize: 22, fontWeight: '700', color: colors.text }}>
                {titleCase(latest.recommended_crop)}
              </Text>
              <Text style={st.badge}>{pct(latest.confidence)}</Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: 12, marginVertical: spacing.sm }}>
              N {latest.inputs.N} · P {latest.inputs.P} · K {latest.inputs.K} · pH {latest.inputs.ph} ·{' '}
              {titleCase(String(latest.inputs.soil_type))} soil · {latest.inputs.water_availability} water
            </Text>
            <ShapBarChart contributions={latest.shap_values} maxItems={5} />
            <Pressable onPress={() => open(latest)} style={{ alignSelf: 'flex-end', marginTop: spacing.sm }}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>Full explanation →</Text>
            </Pressable>
          </Card>

          <Card title="Your crop recommendations">
            <PieChart data={data.crop_distribution.map((d) => ({ label: titleCase(d.crop), value: d.count }))} />
          </Card>

          <Card title="Soil nutrient trend" subtitle="Nitrogen, phosphorus and potassium across your soil tests">
            {data.soil_trend.length < 2 ? (
              <Text style={{ color: colors.muted }}>Make at least two recommendations to see how your soil changes.</Text>
            ) : (
              <LineChart
                labels={data.soil_trend.map((t) => fmtDate(t.date, false))}
                series={[
                  { name: 'Nitrogen', values: data.soil_trend.map((t) => t.N) },
                  { name: 'Phosphorus', values: data.soil_trend.map((t) => t.P) },
                  { name: 'Potassium', values: data.soil_trend.map((t) => t.K) },
                ]}
              />
            )}
          </Card>

          <Card title="What drives your recommendations" subtitle="Average SHAP impact of each factor on your results">
            <ImportanceBars items={data.feature_impact.map((f) => ({ key: f.feature, label: f.label, value: f.impact }))} />
          </Card>
        </>
      )}

      {data.global_importance.length > 0 && (
        <Card
          title="Most important factors overall"
          subtitle={
            data.model
              ? `Model accuracy ${pct(data.model.metrics.accuracy, 1)} · trained on ${data.model.data_source}`
              : undefined
          }
        >
          <ImportanceBars
            color="#1565C0"
            items={data.global_importance.map((g) => ({ key: g.feature, label: g.label, value: g.importance }))}
          />
        </Card>
      )}

      {data.recent_recommendations.length > 0 && (
        <Card title="Recent recommendations">
          {data.recent_recommendations.map((r) => (
            <Pressable key={r.id} style={st.listRow} onPress={() => open(r)}>
              <Ionicons name="leaf" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>{titleCase(r.recommended_crop)}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{fmtDate(r.created_at)}</Text>
              </View>
              <Text style={{ color: colors.muted }}>{pct(r.confidence)}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
          ))}
        </Card>
      )}

      {data.recent_disease_reports.length > 0 && (
        <Card title="Recent disease checks">
          {data.recent_disease_reports.map((r, i) => (
            <View key={i} style={st.listRow}>
              <Ionicons
                name={r.healthy ? 'checkmark-circle' : 'warning'}
                size={20}
                color={r.healthy ? colors.positive : colors.warning}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text }}>{r.predicted_disease}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{fmtDate(r.created_at)}</Text>
              </View>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

function Stat({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={st.stat}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <View>
        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>{value}</Text>
        <Text style={{ fontSize: 11, color: colors.muted }}>{label}</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  greeting: { fontSize: 22, fontWeight: '700', color: colors.text },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginVertical: spacing.lg },
  stat: {
    width: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  badge: {
    backgroundColor: colors.primaryLight,
    color: colors.primaryDark,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    fontWeight: '600',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
