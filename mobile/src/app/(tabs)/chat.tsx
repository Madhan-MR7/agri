import Ionicons from '@expo/vector-icons/Ionicons';
import {
  AudioModule,
  RecordingPresets,
  createAudioPlayer,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type AudioPlayer,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { KeyboardSafeView } from '@/components/KeyboardSafeView';
import { api } from '@/lib/api';
import { stripMarkdown } from '@/lib/format';
import { colors, spacing } from '@/lib/theme';

type Message = { id: string; fromUser: boolean; text: string; audioUrl?: string; source?: string };

let nextId = 0;
const msg = (m: Omit<Message, 'id'>): Message => ({ ...m, id: String(nextId++) });

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const list = useRef<FlatList<Message>>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const player = useRef<AudioPlayer | null>(null);

  useEffect(() => () => player.current?.release(), []);

  const add = (m: Message) => setMessages((prev) => [...prev, m]);

  const play = (url: string) => {
    player.current?.release();
    player.current = createAudioPlayer(url);
    player.current.play();
  };

  const sendText = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    add(msg({ fromUser: true, text }));
    setBusy(true);
    try {
      const res = await api.chat(text);
      add(msg({ fromUser: false, text: res.reply_text, source: res.source_type }));
    } catch (e) {
      add(msg({ fromUser: false, text: `⚠️ ${(e as Error).message}` }));
    } finally {
      setBusy(false);
    }
  };

  const toggleRecording = async () => {
    if (recorderState.isRecording) {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) return;
      const placeholder = msg({ fromUser: true, text: '🎤 Voice message' });
      add(placeholder);
      setBusy(true);
      try {
        const res = await api.voice(uri);
        if (res.user_text) {
          setMessages((prev) => prev.map((m) => (m.id === placeholder.id ? { ...m, text: `🎤 ${res.user_text}` } : m)));
        }
        add(msg({ fromUser: false, text: res.reply_text, audioUrl: res.reply_audio_url || undefined, source: res.source_type }));
        if (res.reply_audio_url) play(res.reply_audio_url);
      } catch (e) {
        add(msg({ fromUser: false, text: `⚠️ ${(e as Error).message}` }));
      } finally {
        setBusy(false);
      }
      return;
    }

    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Microphone needed', 'Allow microphone access to ask questions by voice.');
      return;
    }
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  };

  const recording = recorderState.isRecording;

  return (
    <KeyboardSafeView>
      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(m) => m.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.md, flexGrow: 1 }}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={st.empty}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.muted} />
            <Text style={st.emptyText}>
              Ask anything about crops, soil, fertilizer, pests or weather — type or tap the mic.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[st.bubble, item.fromUser ? st.user : st.bot]}>
            <Text selectable style={{ color: colors.text, fontSize: 15 }}>
              {stripMarkdown(item.text)}
            </Text>
            {item.audioUrl || item.source ? (
              <View style={st.meta}>
                {item.audioUrl ? (
                  <Pressable onPress={() => play(item.audioUrl!)} hitSlop={8}>
                    <Ionicons name="volume-high" size={18} color={colors.primary} />
                  </Pressable>
                ) : null}
                {item.source ? <Text style={st.source}>source: {item.source}</Text> : null}
              </View>
            ) : null}
          </View>
        )}
      />

      {busy ? <ActivityIndicator color={colors.primary} style={{ marginBottom: spacing.sm }} /> : null}

      <View style={st.inputRow}>
        <Pressable
          onPress={toggleRecording}
          disabled={busy}
          style={[st.roundBtn, { backgroundColor: recording ? colors.negative : colors.primaryLight }]}
        >
          <Ionicons name={recording ? 'stop' : 'mic'} size={22} color={recording ? '#fff' : colors.primary} />
        </Pressable>
        <TextInput
          style={st.input}
          value={input}
          onChangeText={setInput}
          placeholder={recording ? 'Listening… tap stop when done' : 'Type your question'}
          placeholderTextColor={colors.muted}
          multiline
          editable={!recording}
        />
        <Pressable
          onPress={sendText}
          disabled={busy || !input.trim()}
          style={[st.roundBtn, { backgroundColor: colors.primary, opacity: busy || !input.trim() ? 0.5 : 1 }]}
        >
          <Ionicons name="send" size={20} color="#fff" />
        </Pressable>
      </View>
    </KeyboardSafeView>
  );
}

const st = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  emptyText: { textAlign: 'center', color: colors.muted, fontSize: 15 },
  bubble: { maxWidth: '85%', padding: spacing.md, borderRadius: 14, marginVertical: 4 },
  user: { alignSelf: 'flex-end', backgroundColor: colors.userBubble },
  bot: {
    alignSelf: 'flex-start',
    backgroundColor: colors.botBubble,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6 },
  source: { fontSize: 11, color: colors.muted },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  roundBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
