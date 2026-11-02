import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DetectionImage } from '@/components/DetectionImage';
import { KeyboardSafeView } from '@/components/KeyboardSafeView';
import { Button, Card, ErrorText, Field } from '@/components/ui';
import { api } from '@/lib/api';
import { pct, stripMarkdown } from '@/lib/format';
import { colors, spacing } from '@/lib/theme';
import type { DiseaseResult } from '@/lib/types';

type Picked = { uri: string; mimeType?: string };

export default function DiseaseScreen() {
  const [images, setImages] = useState<Picked[]>([]);
  const [question, setQuestion] = useState('');
  // Results are shown next to the photos they were computed from, even if the selection changes later
  const [analysis, setAnalysis] = useState<{ images: Picked[]; results: DiseaseResult[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', fromCamera ? 'Allow camera access to take a photo.' : 'Allow photo access.');
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', quality: 0.8 };
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync({ ...options, allowsMultipleSelection: true, selectionLimit: 5 });
    if (!res.canceled) {
      setImages((prev) => [...prev, ...res.assets.map((a) => ({ uri: a.uri, mimeType: a.mimeType }))]);
    }
  };

  const analyze = async () => {
    const sent = images;
    setBusy(true);
    setError(null);
    setAnalysis(null);
    try {
      const res = await api.detectDisease(sent, question.trim());
      setAnalysis({ images: sent, results: res.results });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardSafeView>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: colors.muted, marginBottom: spacing.md }}>
          Take or upload a clear photo of the leaves. AgriBot marks every leaf it finds, names the disease and
          suggests remedies.
        </Text>

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button
            title="Camera"
            variant="outline"
            style={{ flex: 1 }}
            icon={<Ionicons name="camera" size={18} color={colors.primary} />}
            onPress={() => pick(true)}
          />
          <Button
            title="Gallery"
            variant="outline"
            style={{ flex: 1 }}
            icon={<Ionicons name="images" size={18} color={colors.primary} />}
            onPress={() => pick(false)}
          />
        </View>

        {images.length > 0 && (
          <ScrollView horizontal style={{ marginTop: spacing.md }} contentContainerStyle={{ gap: spacing.sm }}>
            {images.map((img, i) => (
              <View key={img.uri}>
                <Image source={{ uri: img.uri }} style={st.thumb} />
                <Pressable style={st.remove} onPress={() => setImages((prev) => prev.filter((_, j) => j !== i))}>
                  <Ionicons name="close" size={14} color="#fff" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}

        <View style={{ marginTop: spacing.md }}>
          <Field
            label="Question (optional)"
            placeholder="e.g. Is it safe to spray before rain?"
            value={question}
            onChangeText={setQuestion}
          />
        </View>

        <Button
          title={busy ? 'Analyzing…' : 'Detect disease'}
          onPress={analyze}
          loading={busy}
          disabled={!images.length}
          style={{ marginTop: spacing.lg }}
        />
        {error ? <ErrorText>{error}</ErrorText> : null}

        {analysis?.results.map((r, i) => (
          <Card key={i} style={{ marginTop: spacing.lg }}>
            <View style={st.titleRow}>
              <Ionicons
                name={!r.detected ? 'help-circle' : r.healthy ? 'checkmark-circle' : 'warning'}
                size={22}
                color={!r.detected ? colors.muted : r.healthy ? colors.positive : colors.warning}
              />
              <Text style={st.title}>{r.predicted_disease}</Text>
              {r.detected ? <Text style={{ color: colors.muted }}>{pct(r.confidence)}</Text> : null}
            </View>

            {analysis.images[i] ? (
              <View style={{ marginTop: spacing.md }}>
                <DetectionImage uri={analysis.images[i].uri} detections={r.detections} />
              </View>
            ) : null}

            {r.summary.length > 0 && (
              <View style={{ marginTop: spacing.md, gap: 4 }}>
                <Text style={st.subhead}>
                  {r.detections.length} {r.detections.length === 1 ? 'leaf' : 'leaves'} found
                </Text>
                {r.summary.map((s) => (
                  <View key={s.label} style={st.summaryRow}>
                    <View style={[st.dot, { backgroundColor: s.healthy ? colors.positive : colors.negative }]} />
                    <Text style={{ flex: 1, color: colors.text }}>
                      {s.label}
                      {s.count > 1 ? ` × ${s.count}` : ''}
                    </Text>
                    <Text style={{ color: colors.muted }}>{pct(s.confidence)}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={st.divider} />
            <Text selectable style={{ color: colors.text, lineHeight: 21 }}>
              {stripMarkdown(r.reply_text)}
            </Text>
          </Card>
        ))}
      </ScrollView>
    </KeyboardSafeView>
  );
}

const st = StyleSheet.create({
  thumb: { width: 96, height: 96, borderRadius: 10 },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
  subhead: { fontSize: 13, fontWeight: '600', color: colors.muted },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.md },
});
