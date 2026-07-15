import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { api, fmtDateTime } from '@/src/api';
import { Header, EmptyState, Button } from '@/src/ui';

export default function Notifications() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await api.notifications();
      setItems(r.items || []);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    // Mark all as read on open
    api.readAll().catch(() => {});
  }, [load]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <Header title="Notifications" onBack={() => router.back()} />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={theme.colors.brandPrimary} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {items.length === 0 ? (
            <EmptyState icon="notifications-outline" title="No notifications" hint="Check-ins will appear here in real time." />
          ) : (
            items.map(n => (
              <Pressable key={n.id} style={[s.row, !n.read && s.unread]} onPress={() => { api.readNotif(n.id).catch(() => {}); if (n.type === 'renewal_due' && n.setup_id) router.push(`/(admin)/setup-form/${n.setup_id}`); else if (n.visit_id) router.push(`/(admin)/visit/${n.visit_id}`); }} testID={`notif-${n.id}`}>
                <View style={[s.dot, n.type === 'renewal_due' && { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name={n.type === 'renewal_due' ? 'refresh-outline' : 'log-in-outline'} size={16} color={n.type === 'renewal_due' ? '#92400E' : theme.colors.brand} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontWeight: '600', color: theme.colors.text }}>{n.title}</Text>
                  <Text style={{ color: theme.colors.text3, fontSize: theme.font.sm }}>{n.body}</Text>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 4 }}>{fmtDateTime(n.created_at)}</Text>
                </View>
                {!n.read ? <View style={s.unreadDot} /> : null}
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, marginBottom: 10, backgroundColor: '#fff' },
  unread: { backgroundColor: theme.colors.brandSecondary + '40', borderColor: theme.colors.brandSecondary },
  dot: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.brandSecondary, alignItems: 'center', justifyContent: 'center' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.brandPrimary },
});
