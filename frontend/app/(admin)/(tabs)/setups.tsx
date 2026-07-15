import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { api } from '@/src/api';
import { Pill, EmptyState } from '@/src/ui';

export default function Setups() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await api.listSetups();
      setItems(rows);
    } catch {}
    setLoading(false);
    setRefresh(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Setups</Text>
        <Pressable style={s.add} onPress={() => router.push('/(admin)/setup-form/new')} testID="add-setup-btn">
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '600' }}>New</Text>
        </Pressable>
      </View>
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={theme.colors.brandPrimary} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(); }} />}
          ListEmptyComponent={<EmptyState title="No setups yet" hint="Add your first customer garden setup." />}
          renderItem={({ item }) => (
            <Pressable style={s.card} onPress={() => router.push(`/(admin)/setup-form/${item.id}`)} testID={`setup-${item.id}`}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={s.name}>{item.customer_name}</Text>
                <Text style={s.meta}>{item.setup_type} · {item.maintenance_plan}</Text>
                <Text style={s.meta} numberOfLines={1}>{item.address || 'No address'}</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                  <Pill text={item.assigned_employee_name || 'Unassigned'} tone={item.assigned_employee_id ? 'brand' : 'warning'} />
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border },
  title: { fontSize: theme.font.xxl, fontWeight: '700', color: theme.colors.text },
  add: { flexDirection: 'row', gap: 4, backgroundColor: theme.colors.brandPrimary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: theme.radius.md, alignItems: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, marginBottom: 10 },
  name: { fontSize: theme.font.lg, fontWeight: '700', color: theme.colors.text },
  meta: { color: theme.colors.text3, fontSize: theme.font.sm },
});
