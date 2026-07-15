import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { theme } from './theme';
import { Ionicons } from '@expo/vector-icons';

export function Button({
  title,
  onPress,
  loading,
  variant = 'primary',
  testID,
  disabled,
  icon,
}: {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  variant?: 'primary' | 'ghost' | 'danger' | 'outline';
  testID?: string;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const styles: any = {
    primary: { bg: theme.colors.brandPrimary, fg: '#fff', border: theme.colors.brandPrimary },
    ghost: { bg: 'transparent', fg: theme.colors.text, border: 'transparent' },
    outline: { bg: '#fff', fg: theme.colors.text, border: theme.colors.border },
    danger: { bg: theme.colors.error, fg: '#fff', border: theme.colors.error },
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      testID={testID}
      style={({ pressed }) => [
        btn.base,
        { backgroundColor: styles.bg, borderColor: styles.border, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={styles.fg} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon ? <Ionicons name={icon} size={18} color={styles.fg} /> : null}
          <Text style={{ color: styles.fg, fontSize: theme.font.lg, fontWeight: '600' }}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}
const btn = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
});

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  multiline,
  testID,
  autoCapitalize,
}: any) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={fld.label}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        multiline={multiline}
        testID={testID}
        autoCapitalize={autoCapitalize}
        placeholderTextColor={theme.colors.textMuted}
        style={[fld.input, multiline && { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 }]}
      />
    </View>
  );
}
const fld = StyleSheet.create({
  label: { fontSize: theme.font.sm, color: theme.colors.text2, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    height: 48,
    color: theme.colors.text,
    fontSize: theme.font.lg,
    backgroundColor: '#fff',
  },
});

export function Card({ children, style }: any) {
  return <View style={[card.wrap, style]}>{children}</View>;
}
const card = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 16,
    backgroundColor: '#fff',
  },
});

export function Pill({ text, tone = 'default' }: { text: string; tone?: 'default' | 'success' | 'warning' | 'error' | 'brand' }) {
  const map: any = {
    default: { bg: theme.colors.surface3, fg: theme.colors.text2 },
    success: { bg: theme.colors.brandSecondary, fg: theme.colors.brand },
    warning: { bg: '#FEF3C7', fg: '#92400E' },
    error: { bg: '#FEE2E2', fg: '#991B1B' },
    brand: { bg: theme.colors.brandSecondary, fg: theme.colors.brand },
  };
  const c = map[tone];
  return (
    <View style={{ backgroundColor: c.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill, alignSelf: 'flex-start' }}>
      <Text style={{ color: c.fg, fontSize: theme.font.sm, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

export function Header({ title, right, onBack, testID }: { title: string; right?: React.ReactNode; onBack?: () => void; testID?: string }) {
  return (
    <View style={hd.wrap} testID={testID}>
      {onBack ? (
        <Pressable onPress={onBack} style={hd.back} hitSlop={10} testID="header-back">
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
      ) : (
        <View style={{ width: 24 }} />
      )}
      <Text style={hd.title} numberOfLines={1}>{title}</Text>
      <View style={{ minWidth: 24, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}
const hd = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    gap: 12,
  },
  title: { flex: 1, fontSize: theme.font.xl, fontWeight: '700', color: theme.colors.text },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});

export function EmptyState({ icon = 'leaf-outline', title, hint }: { icon?: any; title: string; hint?: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, gap: 12 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.brandSecondary, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={28} color={theme.colors.brand} />
      </View>
      <Text style={{ fontSize: theme.font.lg, fontWeight: '600', color: theme.colors.text }}>{title}</Text>
      {hint ? <Text style={{ color: theme.colors.text3, textAlign: 'center', paddingHorizontal: 32 }}>{hint}</Text> : null}
    </View>
  );
}
