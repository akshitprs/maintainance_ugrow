import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { api, getToken, fmtDateTimeSec } from '@/src/api';
import { Header, Pill, Field, Button } from '@/src/ui';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function VisitDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [visit, setVisit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [dl, setDl] = useState(false);

  const load = useCallback(async () => {
    try {
      const v = await api.getVisit(id);
      setVisit(v);
      if (v.rating) { setStars(v.rating.stars); setComment(v.rating.comment || ''); }
    } catch {}
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submitRating = async () => {
    if (!stars) return;
    setSaving(true);
    try { await api.rate(id, stars, comment); await load(); } catch {}
    setSaving(false);
  };

  const downloadPdf = async () => {
    setDl(true);
    try {
      const url = api.singleVisitPdfUrl(id);
      const token = await getToken();
      if (Platform.OS === 'web') {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const blob = await res.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `visit_${id}.pdf`;
        link.click();
      } else {
        const target = `${FileSystem.cacheDirectory}visit_${id}.pdf`;
        const r = await FileSystem.downloadAsync(url, target, { headers: { Authorization: `Bearer ${token}` } });
        await Sharing.shareAsync(r.uri);
      }
    } catch {}
    setDl(false);
  };

  if (loading) return <SafeAreaView style={{ flex: 1 }}><ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.brandPrimary} /></SafeAreaView>;
  if (!visit) return <SafeAreaView style={{ flex: 1 }}><Header title="Visit" onBack={() => router.back()} /><Text style={{ padding: 24 }}>Not found</Text></SafeAreaView>;

  const form = visit.form || {};

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'bottom']}>
      <Header title="Visit Details" onBack={() => router.back()} right={<Pressable onPress={downloadPdf} testID="download-single-pdf">{dl ? <ActivityIndicator /> : <Ionicons name="download-outline" size={22} color={theme.colors.text} />}</Pressable>} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        <View style={s.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={s.title}>{visit.customer_name}</Text>
            <Pill text={visit.status === 'in_progress' ? 'In progress' : 'Completed'} tone={visit.status === 'in_progress' ? 'warning' : 'success'} />
          </View>
          <Text style={s.meta}>{visit.setup_type}</Text>
          <View style={s.row}><Text style={s.k}>Employee</Text><Text style={s.v}>{visit.employee_name}</Text></View>
          <View style={s.row}><Text style={s.k}>Check-in</Text><Text style={s.v} testID="ci-time">{fmtDateTimeSec(visit.check_in_time)}</Text></View>
          <View style={s.row}><Text style={s.k}>Check-out</Text><Text style={s.v} testID="co-time">{fmtDateTimeSec(visit.check_out_time) || '—'}</Text></View>
          <View style={s.row}><Text style={s.k}>Duration</Text><Text style={s.v}>{visit.duration_minutes ? `${visit.duration_minutes} min` : '—'}</Text></View>
        </View>

        {(visit.check_in_lat != null || visit.check_out_lat != null) && (
          <View style={s.card} testID="gps-section">
            <Text style={s.section}>GPS Location</Text>
            {visit.check_in_lat != null && (
              <View>
                <View style={s.row}>
                  <Text style={s.k}>Check-in</Text>
                  <Text style={s.v} testID="gps-checkin-coords">{Number(visit.check_in_lat).toFixed(6)}, {Number(visit.check_in_lng).toFixed(6)}</Text>
                </View>
                <Pressable
                  style={s.mapBtn}
                  onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${visit.check_in_lat},${visit.check_in_lng}`)}
                  testID="gps-checkin-map"
                >
                  <Ionicons name="location" size={16} color={theme.colors.brandPrimary} />
                  <Text style={s.mapBtnTxt}>Open Check-in on Google Maps</Text>
                </Pressable>
              </View>
            )}
            {visit.check_out_lat != null && (
              <View>
                <View style={s.row}>
                  <Text style={s.k}>Check-out</Text>
                  <Text style={s.v} testID="gps-checkout-coords">{Number(visit.check_out_lat).toFixed(6)}, {Number(visit.check_out_lng).toFixed(6)}</Text>
                </View>
                <Pressable
                  style={s.mapBtn}
                  onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${visit.check_out_lat},${visit.check_out_lng}`)}
                  testID="gps-checkout-map"
                >
                  <Ionicons name="location" size={16} color={theme.colors.brandPrimary} />
                  <Text style={s.mapBtnTxt}>Open Check-out on Google Maps</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {Object.keys(form).length > 0 && (
          <View style={s.card}>
            <Text style={s.section}>Maintenance Form</Text>
            {Object.entries(form).map(([k, val]: any) => {
              let display = '';
              if (Array.isArray(val)) {
                if (val.length && typeof val[0] === 'string' && val[0].startsWith('data:')) display = `${val.length} photo(s)`;
                else display = val.join(', ');
              } else if (typeof val === 'object' && val !== null) display = JSON.stringify(val);
              else display = String(val ?? '—');
              return (
                <View key={k} style={s.row}>
                  <Text style={s.k}>{k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</Text>
                  <Text style={s.v} numberOfLines={4}>{display}</Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={s.card}>
          <Text style={s.section}>Rating</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginVertical: 8 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <Pressable key={n} onPress={() => setStars(n)} testID={`star-${n}`}>
                <Ionicons name={n <= stars ? 'star' : 'star-outline'} size={30} color={theme.colors.warning} />
              </Pressable>
            ))}
          </View>
          <Field label="Comment (optional)" value={comment} onChangeText={setComment} multiline testID="rating-comment" />
          <View style={{ height: 8 }} />
          <Button title="Save Rating" onPress={submitRating} loading={saving} disabled={!stars} testID="rating-save" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 16, backgroundColor: '#fff', gap: 8 },
  title: { fontSize: theme.font.xl, fontWeight: '700', color: theme.colors.text },
  section: { fontSize: theme.font.lg, fontWeight: '700', color: theme.colors.text, marginBottom: 6 },
  meta: { color: theme.colors.text3, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.divider },
  k: { color: theme.colors.text3, fontSize: theme.font.sm, flex: 1 },
  v: { color: theme.colors.text, fontSize: theme.font.sm, fontWeight: '600', flex: 2, textAlign: 'right' },
  mapBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, marginTop: 4 },
  mapBtnTxt: { color: theme.colors.brandPrimary, fontWeight: '600', fontSize: theme.font.base },
});
