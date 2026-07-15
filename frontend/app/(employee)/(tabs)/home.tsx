import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { api, fmtDate } from '@/src/api';
import { useAuth } from '@/src/auth';
import { Pill, EmptyState } from '@/src/ui';

function todayLabel() {
  const d = new Date();
  const day = d.toLocaleDateString('en-US', { weekday: 'long' });
  const dayNum = d.getDate();
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  return `Today, ${day}, ${dayNum} ${month}`;
}

export default function EmpHome() {
  const { user } = useAuth();
  const [setups, setSetups] = useState<any[]>([]);
  const [openVisits, setOpenVisits] = useState<Record<string, any>>({});
  const [completedToday, setCompletedToday] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, mine] = await Promise.all([api.listSetups(), api.listVisits({})]);
      setSetups(s);
      const open: Record<string, any> = {};
      const done: Record<string, boolean> = {};
      const todayStr = fmtDate(new Date().toISOString());
      for (const v of mine) {
        if (v.status === 'in_progress') open[v.setup_id] = v;
        if (v.status === 'completed' && fmtDate(v.check_in_time) === todayStr) done[v.setup_id] = true;
      }
      setOpenVisits(open);
      setCompletedToday(done);
    } catch {}
    setLoading(false);
    setRefresh(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const assigned = setups.length;
  const completed = Object.keys(completedToday).length;
  const inProgress = Object.keys(openVisits).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <View style={s.header}>
        <Text style={s.hi}>Hello, {user?.name?.split(' ')[0] || 'there'}</Text>
        <Text style={s.sub}>{todayLabel()}</Text>
      </View>

      <View style={s.stats}>
        {[
          { k: 'assigned', label: 'Assigned', value: assigned },
          { k: 'completed', label: 'Completed', value: completed },
          { k: 'in_progress', label: 'In Progress', value: inProgress },
        ].map(c => (
          <View key={c.k} style={s.statCard} testID={`emp-stat-${c.k}`}>
            <Text style={s.statValue}>{c.value}</Text>
            <Text style={s.statLabel}>{c.label}</Text>
          </View>
        ))}
      </View>

      <Text style={s.sectionTitle}>Assigned Setups</Text>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={theme.colors.brandPrimary} /></View>
      ) : (
        <FlatList
          data={setups}
          keyExtractor={i => i.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(); }} />}
          ListEmptyComponent={<EmptyState icon="calendar-outline" title="No setups assigned" hint="Ask your admin to assign customer setups to you." />}
          renderItem={({ item }) => {
            const active = openVisits[item.id];
            const done = completedToday[item.id];
            let status: 'pending' | 'checked' | 'completed' = 'pending';
            if (done) status = 'completed';
            else if (active) status = 'checked';
            const pill = status === 'completed' ? { text: 'Completed', tone: 'success' as const } : status === 'checked' ? { text: 'Checked-in', tone: 'warning' as const } : { text: 'Pending', tone: 'default' as const };
            return (
              <Pressable
                style={s.card}
                onPress={() => router.push({ pathname: '/(employee)/visit/[setupId]', params: { setupId: item.id } })}
                testID={`setup-card-${item.id}`}
              >
                <View style={{ flex: 1, gap: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <Text style={s.name} numberOfLines={1}>{item.customer_name}</Text>
                    <Pill text={pill.text} tone={pill.tone} />
                  </View>
                  <Text style={s.meta}>{item.setup_type} · {item.maintenance_plan} Maintenance</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="location-outline" size={16} color={theme.colors.textMuted} />
                    <Text style={s.addr} numberOfLines={1}>{item.address || ' '}</Text>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  hi: { fontSize: 28, fontWeight: '700', color: theme.colors.text },
  sub: { color: theme.colors.text3, marginTop: 4, fontSize: theme.font.lg },
  stats: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 24 },
  statCard: { flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 14, backgroundColor: '#fff', gap: 4 },
  statValue: { fontSize: 28, fontWeight: '700', color: theme.colors.text },
  statLabel: { color: theme.colors.text3, fontSize: theme.font.sm },
  sectionTitle: { fontSize: theme.font.xl, fontWeight: '700', color: theme.colors.text, paddingHorizontal: 16, marginBottom: 12 },
  card: { padding: 16, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, marginBottom: 12, backgroundColor: '#fff' },
  name: { fontSize: theme.font.xl, fontWeight: '700', color: theme.colors.text, flex: 1 },
  meta: { color: theme.colors.text3, fontSize: theme.font.base },
  addr: { color: theme.colors.text3, fontSize: theme.font.base, flex: 1 },
});
