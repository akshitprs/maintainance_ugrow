import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { theme } from '@/src/theme';
import { api } from '@/src/api';
import { Header, Field, Button, Pill } from '@/src/ui';

const SECTIONS = ['Plants', 'Maintenance', 'Pesticide', 'Cleaning', 'Drip', 'Problems', 'Materials', 'Customer', 'Summary', 'Photos'] as const;

export default function VisitFlow() {
  const { setupId } = useLocalSearchParams<{ setupId: string }>();
  const [setup, setSetup] = useState<any>(null);
  const [visit, setVisit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ci, setCi] = useState(false);
  const [co, setCo] = useState(false);
  const [form, setForm] = useState<any>({
    weather: '', plants_checked: '', plants_dead: '', plants_replaced: '', new_plantation: '', harvest: '',
    watering: false, weeding: false, pruning: false,
    fertilizer_type: '', fertilizer_qty: '',
    pesticide_used: false, pesticide_details: '',
    cleaning_done: false,
    drip_ok: true, drip_notes: '',
    problems: '', materials_used: '',
    customer_present: false, customer_feedback: '', customer_complaints: '',
    work_summary: '', next_visit_recommendation: '',
    photos_before: [] as string[], photos_after: [] as string[], photos_problem: [] as string[],
  });

  const load = useCallback(async () => {
    try {
      const s = await api.getSetup(setupId);
      setSetup(s);
      const open = (await api.listVisits({ status: 'in_progress', setup_id: setupId })).find((v: any) => v.setup_id === setupId);
      if (open) setVisit(open);
    } catch (e) {}
    setLoading(false);
  }, [setupId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const doCheckin = async () => {
    setCi(true);
    try {
      let lat: number | undefined, lng: number | undefined;
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({});
          lat = pos.coords.latitude; lng = pos.coords.longitude;
        }
      } catch {}
      const v = await api.checkin(setupId, lat, lng);
      setVisit(v);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e: any) {
      console.log(e);
    }
    setCi(false);
  };

  const pickImage = async (bucket: 'photos_before' | 'photos_after' | 'photos_problem') => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    const useLib = perm.status !== 'granted';
    const res = useLib
      ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.5, base64: true })
      : await ImagePicker.launchCameraAsync({ quality: 0.5, base64: true });
    if (!res.canceled && res.assets?.[0]?.base64) {
      const dataUrl = `data:image/jpeg;base64,${res.assets[0].base64}`;
      setForm({ ...form, [bucket]: [...form[bucket], dataUrl] });
      Haptics.selectionAsync().catch(() => {});
    }
  };

  const doCheckout = async () => {
    if (!visit) return;
    setCo(true);
    try {
      let lat: number | undefined, lng: number | undefined;
      try {
        const pos = await Location.getCurrentPositionAsync({});
        lat = pos.coords.latitude; lng = pos.coords.longitude;
      } catch {}
      await api.checkout(visit.id, form, lat, lng);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } catch (e: any) {
      console.log(e);
    }
    setCo(false);
  };

  if (loading) return <SafeAreaView style={{ flex: 1 }}><ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.brandPrimary} /></SafeAreaView>;
  if (!setup) return <SafeAreaView style={{ flex: 1 }}><Header title="Visit" onBack={() => router.back()} /></SafeAreaView>;

  const Toggle = ({ label, k }: { label: string; k: string }) => (
    <Pressable
      style={s.toggle}
      onPress={() => { setForm({ ...form, [k]: !form[k] }); Haptics.selectionAsync().catch(() => {}); }}
      testID={`toggle-${k}`}
    >
      <Text style={{ color: theme.colors.text, fontSize: theme.font.base, flex: 1 }}>{label}</Text>
      <View style={[s.switch, form[k] && s.switchOn]}>
        <View style={[s.knob, form[k] && s.knobOn]} />
      </View>
    </Pressable>
  );

  const PhotoBucket = ({ label, k }: { label: string; k: 'photos_before' | 'photos_after' | 'photos_problem' }) => (
    <View style={{ gap: 8 }}>
      <Text style={s.label}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {form[k].map((uri: string, i: number) => (
          <Image key={i} source={{ uri }} style={s.photo} />
        ))}
        <Pressable style={s.photoAdd} onPress={() => pickImage(k)} testID={`photo-${k}`}>
          <Ionicons name="camera-outline" size={24} color={theme.colors.text3} />
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'bottom']}>
      <Header title={setup.customer_name} onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          <View style={s.summary}>
            <Text style={s.summaryTitle}>{setup.setup_type} · {setup.maintenance_plan}</Text>
            <Text style={{ color: theme.colors.text3, fontSize: theme.font.sm, marginTop: 4 }} numberOfLines={2}>{setup.address}</Text>
            <View style={{ marginTop: 8 }}>
              <Pill text={visit ? 'Checked-in' : 'Not started'} tone={visit ? 'warning' : 'default'} />
            </View>
          </View>

          {!visit ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ color: theme.colors.text3, marginBottom: 12, textAlign: 'center' }}>Tap check-in to record GPS and start the maintenance form.</Text>
              <Button title="Check In" icon="location-outline" onPress={doCheckin} loading={ci} testID="checkin-btn" />
            </View>
          ) : (
            <>
              {/* Plants */}
              <SectionHeader title="Plants" />
              <Field label="Weather" value={form.weather} onChangeText={(v: string) => setForm({ ...form, weather: v })} />
              <View style={{ height: 12 }} />
              <Field label="Plants checked" value={form.plants_checked} onChangeText={(v: string) => setForm({ ...form, plants_checked: v })} keyboardType="numeric" />
              <View style={{ height: 12 }} />
              <Field label="Plants dead" value={form.plants_dead} onChangeText={(v: string) => setForm({ ...form, plants_dead: v })} keyboardType="numeric" />
              <View style={{ height: 12 }} />
              <Field label="Plants replaced" value={form.plants_replaced} onChangeText={(v: string) => setForm({ ...form, plants_replaced: v })} keyboardType="numeric" />
              <View style={{ height: 12 }} />
              <Field label="New plantation" value={form.new_plantation} onChangeText={(v: string) => setForm({ ...form, new_plantation: v })} />
              <View style={{ height: 12 }} />
              <Field label="Harvest" value={form.harvest} onChangeText={(v: string) => setForm({ ...form, harvest: v })} />

              <SectionHeader title="Maintenance" />
              <Toggle label="Watering done" k="watering" />
              <Toggle label="Weeding done" k="weeding" />
              <Toggle label="Pruning done" k="pruning" />
              <View style={{ height: 12 }} />
              <Field label="Fertilizer type" value={form.fertilizer_type} onChangeText={(v: string) => setForm({ ...form, fertilizer_type: v })} />
              <View style={{ height: 12 }} />
              <Field label="Fertilizer quantity" value={form.fertilizer_qty} onChangeText={(v: string) => setForm({ ...form, fertilizer_qty: v })} />

              <SectionHeader title="Pesticide" />
              <Toggle label="Pesticide used" k="pesticide_used" />
              <View style={{ height: 12 }} />
              <Field label="Pesticide details" value={form.pesticide_details} onChangeText={(v: string) => setForm({ ...form, pesticide_details: v })} multiline />

              <SectionHeader title="Cleaning" />
              <Toggle label="Cleaning done" k="cleaning_done" />

              <SectionHeader title="Drip Irrigation" />
              <Toggle label="Drip lines OK" k="drip_ok" />
              <View style={{ height: 12 }} />
              <Field label="Drip notes" value={form.drip_notes} onChangeText={(v: string) => setForm({ ...form, drip_notes: v })} multiline />

              <SectionHeader title="Problems" />
              <Field label="Problems encountered" value={form.problems} onChangeText={(v: string) => setForm({ ...form, problems: v })} multiline />

              <SectionHeader title="Materials" />
              <Field label="Materials used" value={form.materials_used} onChangeText={(v: string) => setForm({ ...form, materials_used: v })} multiline />

              <SectionHeader title="Customer" />
              <Toggle label="Customer present" k="customer_present" />
              <View style={{ height: 12 }} />
              <Field label="Customer feedback" value={form.customer_feedback} onChangeText={(v: string) => setForm({ ...form, customer_feedback: v })} multiline />
              <View style={{ height: 12 }} />
              <Field label="Customer complaints" value={form.customer_complaints} onChangeText={(v: string) => setForm({ ...form, customer_complaints: v })} multiline />

              <SectionHeader title="Summary" />
              <Field label="Work summary" value={form.work_summary} onChangeText={(v: string) => setForm({ ...form, work_summary: v })} multiline />
              <View style={{ height: 12 }} />
              <Field label="Next visit recommendation" value={form.next_visit_recommendation} onChangeText={(v: string) => setForm({ ...form, next_visit_recommendation: v })} multiline />

              <SectionHeader title="Photos" />
              <PhotoBucket label="Before" k="photos_before" />
              <View style={{ height: 12 }} />
              <PhotoBucket label="After" k="photos_after" />
              <View style={{ height: 12 }} />
              <PhotoBucket label="Problem" k="photos_problem" />
            </>
          )}
        </ScrollView>

        {visit ? (
          <View style={s.stickyCta}>
            <Button title="Complete Maintenance" icon="checkmark-done" onPress={doCheckout} loading={co} testID="checkout-btn" />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={{ marginTop: 28, marginBottom: 12, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: theme.colors.text }}>
      <Text style={{ fontSize: theme.font.lg, fontWeight: '700', color: theme.colors.text }}>{title}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  summary: { padding: 14, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, backgroundColor: '#fff' },
  summaryTitle: { fontSize: theme.font.lg, fontWeight: '700', color: theme.colors.text },
  label: { fontSize: theme.font.sm, color: theme.colors.text2, fontWeight: '600' },
  toggle: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  switch: { width: 44, height: 26, borderRadius: 13, backgroundColor: theme.colors.surface3, justifyContent: 'center', padding: 3 },
  switchOn: { backgroundColor: theme.colors.brandPrimary },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  knobOn: { alignSelf: 'flex-end' },
  photo: { width: 72, height: 72, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surface3 },
  photoAdd: { width: 72, height: 72, borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  stickyCta: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.95)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border, padding: 16 },
});
