import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { theme } from '@/src/theme';
import { api } from '@/src/api';
import { Pill, EmptyState } from '@/src/ui';

export default function MyVisits() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await api.listVisits({})); } catch {}
    setLoading(false); setRefresh(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <View style={s.header}><Text style={s.title}>My Visits</Text></View>
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={theme.colors.brandPrimary} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(); }} />}
          ListEmptyComponent={<EmptyState icon="clipboard-outline" title="No visits yet" />}
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.name}>{item.customer_name}</Text>
                <Text style={s.meta}>{(item.check_in_time || '').replace('T', ' ').slice(0, 16)}</Text>
                <Text style={s.meta}>{item.duration_minutes ? `${item.duration_minutes} min` : '—'}</Text>
              </View>
              <Pill text={item.status === 'in_progress' ? 'In progress' : 'Completed'} tone={item.status === 'in_progress' ? 'warning' : 'success'} />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border },
  title: { fontSize: theme.font.xxl, fontWeight: '700', color: theme.colors.text },
  card: { flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, marginBottom: 10 },
  name: { fontSize: theme.font.lg, fontWeight: '700', color: theme.colors.text },
  meta: { color: theme.colors.text3, fontSize: theme.font.sm },
});
