import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { api, API_URL, getToken } from '@/src/api';
import { Field, Pill, EmptyState, Button } from '@/src/ui';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const STATUSES = ['All', 'in_progress', 'completed'];

export default function Reports() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState<string>('All');
  const [employeeId, setEmployeeId] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<'csv' | 'pdf' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api.listVisits({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        status: status === 'All' ? undefined : status,
        employee_id: employeeId || undefined,
      });
      setItems(rows);
    } catch {}
    setLoading(false);
  }, [dateFrom, dateTo, status, employeeId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    for (const v of items) {
      const d = (v.check_in_time || '').slice(0, 10) || 'Unknown';
      (g[d] = g[d] || []).push(v);
    }
    return Object.entries(g).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [items]);

  const download = async (fmt: 'csv' | 'pdf') => {
    setDownloading(fmt);
    const params: any = { format: fmt };
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (status !== 'All') params.status = status;
    if (employeeId) params.employee_id = employeeId;

    const url = api.reportsUrl(params);
    const token = await getToken();

    if (Platform.OS === 'web') {
      // Fetch as blob, trigger download
      try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const blob = await res.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `visits_${dateFrom || 'all'}_to_${dateTo || 'all'}.${fmt}`;
        link.click();
      } catch (e: any) {
        console.log('download error', e);
      }
    } else {
      const target = `${FileSystem.cacheDirectory}visits_${Date.now()}.${fmt}`;
      const dl = await FileSystem.downloadAsync(url, target, { headers: { Authorization: `Bearer ${token}` } });
      await Sharing.shareAsync(dl.uri);
    }
    setDownloading(null);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Reports</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="From (YYYY-MM-DD)" value={dateFrom} onChangeText={setDateFrom} placeholder="2026-05-01" testID="report-from" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="To (YYYY-MM-DD)" value={dateTo} onChangeText={setDateTo} placeholder="2026-05-31" testID="report-to" />
            </View>
          </View>

          <View>
            <Text style={s.label}>Status</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {STATUSES.map(st => {
                const active = status === st;
                return (
                  <Pressable
                    key={st}
                    onPress={() => setStatus(st)}
                    style={[s.chip, active && s.chipActive]}
                    testID={`chip-${st}`}
                  >
                    <Text style={[s.chipTxt, active && s.chipTxtActive]}>{st === 'in_progress' ? 'In progress' : st === 'completed' ? 'Completed' : 'All'}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable style={[s.applyBtn, { flex: 1, backgroundColor: theme.colors.brandPrimary }]} onPress={load} testID="report-apply">
              <Ionicons name="funnel-outline" color="#fff" size={16} />
              <Text style={{ color: '#fff', fontWeight: '600' }}>Apply</Text>
            </Pressable>
            <Pressable style={[s.applyBtn, { flex: 1, borderWidth: 1, borderColor: theme.colors.border }]} onPress={() => download('csv')} testID="export-csv">
              {downloading === 'csv' ? <ActivityIndicator color={theme.colors.text} /> : <><Ionicons name="download-outline" size={16} color={theme.colors.text} /><Text style={{ fontWeight: '600', color: theme.colors.text }}>CSV</Text></>}
            </Pressable>
            <Pressable style={[s.applyBtn, { flex: 1, borderWidth: 1, borderColor: theme.colors.border }]} onPress={() => download('pdf')} testID="export-pdf">
              {downloading === 'pdf' ? <ActivityIndicator color={theme.colors.text} /> : <><Ionicons name="document-outline" size={16} color={theme.colors.text} /><Text style={{ fontWeight: '600', color: theme.colors.text }}>PDF</Text></>}
            </Pressable>
          </View>
        </View>

        <View style={{ height: 20 }} />

        {loading ? (
          <ActivityIndicator color={theme.colors.brandPrimary} />
        ) : grouped.length === 0 ? (
          <EmptyState icon="document-text-outline" title="No visits found" hint="Try changing filters." />
        ) : (
          grouped.map(([date, rows]) => (
            <View key={date} style={{ marginBottom: 18 }}>
              <Text style={s.dateHeader}>{date}</Text>
              {rows.map(v => (
                <Pressable key={v.id} style={s.row} onPress={() => router.push(`/(admin)/visit/${v.id}`)} testID={`report-row-${v.id}`}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ fontWeight: '600', color: theme.colors.text }}>{v.customer_name}</Text>
                    <Text style={{ color: theme.colors.text3, fontSize: theme.font.sm }}>{v.employee_name} · {(v.duration_minutes || 0)}m</Text>
                  </View>
                  <Pill text={v.status === 'in_progress' ? 'In progress' : 'Completed'} tone={v.status === 'in_progress' ? 'warning' : 'success'} />
                </Pressable>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border },
  title: { fontSize: theme.font.xxl, fontWeight: '700', color: theme.colors.text },
  label: { fontSize: theme.font.sm, color: theme.colors.text2, fontWeight: '600', marginBottom: 6 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  chipActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  chipTxt: { color: theme.colors.text2, fontWeight: '600', fontSize: theme.font.sm },
  chipTxtActive: { color: '#fff' },
  applyBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: theme.radius.md },
  dateHeader: { fontSize: theme.font.base, fontWeight: '700', color: theme.colors.text2, marginBottom: 8, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, marginBottom: 8 },
});
