import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { colors, spacing } from '@/lib/theme';

export function Card({ title, subtitle, children, style }: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.card, style]}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
      {title || subtitle ? <View style={{ height: spacing.md }} /> : null}
      {children}
    </View>
  );
}

export function Button({ title, onPress, disabled, loading, variant = 'filled', icon, style }: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'filled' | 'outline';
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const filled = variant === 'filled';
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        filled ? styles.buttonFilled : styles.buttonOutline,
        inactive && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={filled ? '#fff' : colors.primary} /> : icon}
      <Text style={[styles.buttonText, { color: filled ? '#fff' : colors.primary }]}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.chip, selected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
    >
      <Text style={{ color: selected ? '#fff' : colors.text, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function ChipGroup<T extends string>({ options, value, onChange, labels }: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Record<string, string>;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((o) => (
        <Chip key={o} label={labels?.[o] ?? o} selected={o === value} onPress={() => onChange(o)} />
      ))}
    </View>
  );
}

export function Field({ label, error, hint, suffix, ...input }: TextInputProps & {
  label: string;
  error?: string | null;
  hint?: string;
  suffix?: string;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputWrap, error ? { borderColor: colors.negative } : null]}>
        <TextInput placeholderTextColor={colors.muted} style={styles.input} {...input} />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <Text style={[styles.error, { fontSize: 14, marginTop: spacing.sm }]}>{children}</Text>;
}

export const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  cardSubtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: 24,
  },
  buttonFilled: { backgroundColor: colors.primary },
  buttonOutline: { borderWidth: 1, borderColor: colors.primary, backgroundColor: 'transparent' },
  buttonText: { fontSize: 15, fontWeight: '600' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  fieldLabel: { fontSize: 13, color: colors.muted, marginBottom: 4 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
  },
  input: { flex: 1, minHeight: 44, fontSize: 16, color: colors.text },
  suffix: { color: colors.muted, fontSize: 13, marginLeft: 4 },
  hint: { fontSize: 11, color: colors.muted, marginTop: 2 },
  error: { fontSize: 11, color: colors.negative, marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
});
