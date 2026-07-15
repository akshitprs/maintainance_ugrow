import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { api, fmtDateTimeSec } from '@/src/api';
import { useAuth } from '@/src/auth';
import { Pill } from '@/src/ui';

function headerDate() {
  const d = new Date();
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [unread, setUnread] = useState(0);
  const [refresh, setRefresh] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [s, n] = await Promise.all([api.dashboard(), api.notifications()]);
      setStats(s);
      setUnread(n.unread || 0);
    } catch (e) {}
    setLoading(false);
    setRefresh(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  const statCards = stats ? [
    { key: 'todays_visits', label: "Today's Visits", value: stats.todays_visits, icon: 'calendar-outline', bg: theme.colors.brandSecondary, fg: theme.colors.brand },
    { key: 'completed', label: 'Completed', value: stats.completed, icon: 'checkmark-circle', bg: theme.colors.brandSecondary, fg: theme.colors.brandPrimary },
    { key: 'pending', label: 'Pending', value: stats.pending, icon: 'time-outline', bg: '#FEF3C7', fg: theme.colors.warning },
    { key: 'working_now', label: 'Working Now', value: stats.working_now, icon: 'people', bg: '#DBEAFE', fg: '#2563EB' },
    { key: 'active_setups', label: 'Active Setups', value: stats.active_setups, icon: 'leaf', bg: theme.colors.brandSecondary, fg: theme.colors.brandPrimary },
    { key: 'employees', label: 'Employees', value: stats.employees, icon: 'person', bg: theme.colors.surface3, fg: theme.colors.text3 },
  ] : [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <View style={s.header} testID="admin-dashboard-header">
        <View style={{ flex: 1 }}>
          <Text style={s.hi}>Welcome, {user?.name || 'Admin'}</Text>
          <Text style={s.sub}>{headerDate()}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable style={s.iconBtn} onPress={() => router.push('/(admin)/(tabs)/reports')} testID="reports-btn">
            <Ionicons name="document-text-outline" size={22} color={theme.colors.text} />
          </Pressable>
          <Pressable style={s.iconBtn} onPress={() => router.push('/(admin)/notifications')} testID="notif-bell">
            <Ionicons name="notifications-outline" size={22} color={theme.colors.text} />
            {unread > 0 ? (
              <View style={s.badge} testID="notif-badge">
                <Text style={s.badgeTxt}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.colors.brandPrimary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(); }} tintColor={theme.colors.brandPrimary} />}
        >
          <View style={s.grid}>
            {statCards.map(c => (
              <View key={c.key} style={s.stat} testID={`stat-${c.key}`}>
                <View style={[s.statIcon, { backgroundColor: c.bg }]}>
                  <Ionicons name={c.icon as any} size={18} color={c.fg} />
                </View>
                <Text style={s.statValue}>{c.value}</Text>
                <Text style={s.statLabel}>{c.label}</Text>
              </View>
            ))}
          </View>

          <View style={{ marginTop: 28 }}>
            <Text style={s.section}>Live Activity</Text>
            {(stats?.recent_activity || []).length === 0 ? (
              <Text style={{ color: theme.colors.text3, paddingVertical: 24, textAlign: 'center' }}>No recent visits yet.</Text>
            ) : (
              (stats.recent_activity as any[]).map(v => (
                <Pressable key={v.id} style={s.activity} onPress={() => router.push(`/(admin)/visit/${v.id}`)} testID={`activity-${v.id}`}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={s.actName}>{v.employee_name} → {v.customer_name}</Text>
                    <Text style={s.actDate}>{fmtDateTimeSec(v.check_in_time)}</Text>
                  </View>
                  <Pill text={v.status === 'in_progress' ? 'In progress' : 'Completed'} tone={v.status === 'in_progress' ? 'warning' : 'success'} />
                </Pressable>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 12 },
  hi: { fontSize: 28, fontWeight: '700', color: theme.colors.text },
  sub: { color: theme.colors.text3, marginTop: 4, fontSize: theme.font.lg },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.surface3, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: theme.colors.error, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeTxt: { color: '#fff', fontSize: 10, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { flexBasis: '48%', flexGrow: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 16, backgroundColor: '#fff', gap: 10 },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 32, fontWeight: '700', color: theme.colors.text, marginTop: 4 },
  statLabel: { color: theme.colors.text3, fontSize: theme.font.base },
  section: { fontSize: theme.font.xl, fontWeight: '700', color: theme.colors.text, marginBottom: 12 },
  activity: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 14, marginBottom: 10, backgroundColor: '#fff' },
  actName: { fontWeight: '700', color: theme.colors.text, fontSize: theme.font.lg },
  actDate: { color: theme.colors.text3, fontSize: theme.font.sm },
});
