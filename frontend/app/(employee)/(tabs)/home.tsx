import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth';
import { Pill, EmptyState } from '@/src/ui';

export default function EmpHome() {
  const { user } = useAuth();
  const [setups, setSetups] = useState<any[]>([]);
  const [openVisits, setOpenVisits] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, v] = await Promise.all([api.listSetups(), api.listVisits({ status: 'in_progress' })]);
      setSetups(s);
      const map: Record<string, any> = {};
      for (const vv of v) map[vv.setup_id] = vv;
      setOpenVisits(map);
    } catch {}
    setLoading(false);
    setRefresh(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <View style={s.header}>
        <View>
          <Text style={s.hi}>Hi, {user?.name?.split(' ')[0] || 'there'}</Text>
          <Text style={s.sub}>Today's assigned setups</Text>
        </View>
      </View>
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={theme.colors.brandPrimary} /></View>
      ) : (
        <FlatList
          data={setups}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(); }} />}
          ListEmptyComponent={<EmptyState icon="calendar-outline" title="No setups assigned" hint="Ask your admin to assign customer setups to you." />}
          renderItem={({ item }) => {
            const active = openVisits[item.id];
            return (
              <Pressable
                style={s.card}
                onPress={() => router.push({ pathname: '/(employee)/visit/[setupId]', params: { setupId: item.id, visitId: active?.id || '' } })}
                testID={`setup-card-${item.id}`}
              >
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={s.name}>{item.customer_name}</Text>
                  <Text style={s.meta} numberOfLines={2}>{item.address || 'No address'}</Text>
                  <Text style={s.meta}>{item.setup_type} · {item.maintenance_plan}</Text>
                  <Pill text={active ? 'Checked-in' : 'Pending'} tone={active ? 'warning' : 'default'} />
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border },
  hi: { fontSize: theme.font.xxl, fontWeight: '700', color: theme.colors.text },
  sub: { color: theme.colors.text3, marginTop: 2 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, marginBottom: 10 },
  name: { fontSize: theme.font.lg, fontWeight: '700', color: theme.colors.text },
  meta: { color: theme.colors.text3, fontSize: theme.font.sm },
});
