import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { Button } from '@/src/ui';
import { useAuth } from '@/src/auth';
import { Ionicons } from '@expo/vector-icons';

export default function Profile() {
  const { user, logout } = useAuth();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <View style={s.header}><Text style={s.title}>Profile</Text></View>
      <View style={{ padding: 24, gap: 16, alignItems: 'center' }}>
        <View style={s.avatar}>
          <Ionicons name="person" size={36} color={theme.colors.brand} />
        </View>
        <Text style={{ fontSize: theme.font.xl, fontWeight: '700', color: theme.colors.text }}>{user?.name}</Text>
        <Text style={{ color: theme.colors.text3 }}>{user?.email}</Text>
        <View style={{ height: 12 }} />
        <View style={{ alignSelf: 'stretch' }}>
          <Button title="Sign out" onPress={logout} variant="danger" testID="signout-btn" />
        </View>
      </View>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border },
  title: { fontSize: theme.font.xxl, fontWeight: '700', color: theme.colors.text },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: theme.colors.brandSecondary, alignItems: 'center', justifyContent: 'center' },
});
