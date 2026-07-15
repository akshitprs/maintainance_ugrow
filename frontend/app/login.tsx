import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { Button, Field } from '@/src/ui';
import { useAuth } from '@/src/auth';
import { Ionicons } from '@expo/vector-icons';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@ugrow.com');
  const [password, setPassword] = useState('Admin@123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
          <View style={s.logoRing} testID="login-logo">
            <Ionicons name="leaf" size={36} color={theme.colors.brand} />
          </View>
          <Text style={s.brand}>UGrow Naturals</Text>
          <Text style={s.subtitle}>Field service management</Text>

          <View style={{ height: 32 }} />

          <View style={{ gap: 16 }}>
            <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@ugrow.com" keyboardType="email-address" autoCapitalize="none" testID="login-email-input" />
            <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry testID="login-password-input" />
            {error ? <Text style={{ color: theme.colors.error, fontSize: theme.font.sm }} testID="login-error">{error}</Text> : null}
            <View style={{ height: 8 }} />
            <Button title="Sign in" onPress={submit} loading={loading} testID="login-submit-button" />
          </View>

          <View style={s.hint}>
            <Text style={{ color: theme.colors.text3, fontSize: theme.font.sm }}>Admin demo: admin@ugrow.com / Admin@123</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 24, flexGrow: 1, justifyContent: 'center' },
  logoRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.brandSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  brand: { fontSize: 28, fontWeight: '700', color: theme.colors.text },
  subtitle: { color: theme.colors.text3, marginTop: 4 },
  hint: { marginTop: 24, alignItems: 'center' },
});
