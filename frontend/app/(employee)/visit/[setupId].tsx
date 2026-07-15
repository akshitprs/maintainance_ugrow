import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable, KeyboardAvoidingView, Platform, Image, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { theme } from '@/src/theme';
import { api } from '@/src/api';
import { Header, Field, Button, Pill } from '@/src/ui';

const SECTIONS = [
  { key: 'plants', label: 'Plants', icon: 'leaf-outline' as const },
  { key: 'maintenance', label: 'Maintenance', icon: 'construct-outline' as const },
  { key: 'pesticide', label: 'Pesticide', icon: 'flask-outline' as const },
  { key: 'cleaning', label: 'Cleaning', icon: 'sparkles-outline' as const },
  { key: 'drip', label: 'Drip', icon: 'water-outline' as const },
  { key: 'problems', label: 'Problems', icon: 'alert-circle-outline' as const },
  { key: 'materials', label: 'Materials', icon: 'cube-outline' as const },
  { key: 'customer', label: 'Customer', icon: 'person-outline' as const },
  { key: 'summary', label: 'Summary', icon: 'document-text-outline' as const },
  { key: 'photos', label: 'Photos', icon: 'camera-outline' as const },
];

const WEATHER = ['Sunny', 'Cloudy', 'Rainy', 'Hot', 'Windy'];

type ToggleProps = { label: string; k: string; icon: keyof typeof Ionicons.glyphMap; form: any; setForm: (f: any) => void };
const Toggle = React.memo(({ label, k, icon, form, setForm }: ToggleProps) => (
  <Pressable style={[s.toggle, form[k] && s.toggleOn]} onPress={() => { setForm({ ...form, [k]: !form[k] }); Haptics.selectionAsync().catch(() => {}); }} testID={`toggle-${k}`}>
    <View style={[s.toggleIcon, form[k] && s.toggleIconOn]}>
      <Ionicons name={icon} size={18} color={form[k] ? '#fff' : theme.colors.text3} />
    </View>
    <Text style={[s.toggleLabel, form[k] && { color: theme.colors.brand }]}>{label}</Text>
    <View style={[s.switch, form[k] && s.switchOn]}>
      <View style={[s.knob, form[k] && s.knobOn]} />
    </View>
  </Pressable>
));

type StepperProps = { k: string; form: any; setForm: (f: any) => void };
const Stepper = React.memo(({ k, form, setForm }: StepperProps) => {
  const val = Number(form[k]) || 0;
  const set = (v: number) => setForm({ ...form, [k]: Math.max(0, v) });
  return (
    <View style={s.stepper}>
      <Pressable style={s.stepBtn} onPress={() => { set(val - 1); Haptics.selectionAsync().catch(() => {}); }} testID={`step-dec-${k}`}>
        <Ionicons name="remove" size={18} color={theme.colors.text} />
      </Pressable>
      <TextInput
        value={String(val)}
        onChangeText={(t) => set(parseInt(t.replace(/[^0-9]/g, '') || '0', 10))}
        keyboardType="numeric"
        style={s.stepValue}
        testID={`step-val-${k}`}
      />
      <Pressable style={s.stepBtn} onPress={() => { set(val + 1); Haptics.selectionAsync().catch(() => {}); }} testID={`step-inc-${k}`}>
        <Ionicons name="add" size={18} color={theme.colors.text} />
      </Pressable>
    </View>
  );
});

type PhotoBucketProps = { label: string; k: 'photos_before' | 'photos_after' | 'photos_problem'; form: any; pickImage: (b: any) => void; removePhoto: (b: any, i: number) => void };
const PhotoBucket = React.memo(({ label, k, form, pickImage, removePhoto }: PhotoBucketProps) => (
  <View style={{ gap: 10 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={s.subLabel}>{label}</Text>
      <Text style={{ color: theme.colors.text3, fontSize: theme.font.sm }}>{form[k].length} added</Text>
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {form[k].map((uri: string, i: number) => (
        <View key={i} style={s.photoWrap}>
          <Image source={{ uri }} style={s.photo} />
          <Pressable style={s.photoRm} onPress={() => removePhoto(k, i)} testID={`photo-rm-${k}-${i}`}>
            <Ionicons name="close" size={12} color="#fff" />
          </Pressable>
        </View>
      ))}
      <Pressable style={s.photoAdd} onPress={() => pickImage(k)} testID={`photo-${k}`}>
        <Ionicons name="camera" size={22} color={theme.colors.brand} />
        <Text style={{ color: theme.colors.text3, fontSize: 11, marginTop: 4 }}>Add</Text>
      </Pressable>
    </View>
  </View>
));

function useElapsed(startIso?: string) {
  const [t, setT] = useState('');
  useEffect(() => {
    if (!startIso) return;
    const start = new Date(startIso).getTime();
    const tick = () => {
      const diff = Math.max(0, Date.now() - start);
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setT(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startIso]);
  return t;
}

export default function VisitFlow() {
  const { setupId } = useLocalSearchParams<{ setupId: string }>();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const sectionYs = useRef<Record<string, number>>({});

  const [setup, setSetup] = useState<any>(null);
  const [visit, setVisit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ci, setCi] = useState(false);
  const [co, setCo] = useState(false);
  const [activeSection, setActiveSection] = useState('plants');
  const [form, setForm] = useState<any>({
    weather: '',
    plants_checked: 0, plants_dead: 0, plants_replaced: 0,
    new_plantation: '', harvest: '',
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

  const elapsed = useElapsed(visit?.check_in_time);

  const load = useCallback(async () => {
    try {
      const s = await api.getSetup(setupId);
      setSetup(s);
      const open = (await api.listVisits({ status: 'in_progress', setup_id: setupId })).find((v: any) => v.setup_id === setupId);
      if (open) setVisit(open);
    } catch {}
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
    } catch (e) { console.log(e); }
    setCi(false);
  };

  const pickImage = async (bucket: 'photos_before' | 'photos_after' | 'photos_problem') => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    const useLib = perm.status !== 'granted';
    const res = useLib
      ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5, base64: true })
      : await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5, base64: true });
    if (!res.canceled && res.assets?.[0]?.base64) {
      const dataUrl = `data:image/jpeg;base64,${res.assets[0].base64}`;
      setForm((f: any) => ({ ...f, [bucket]: [...f[bucket], dataUrl] }));
      Haptics.selectionAsync().catch(() => {});
    }
  };
  const removePhoto = (bucket: 'photos_before' | 'photos_after' | 'photos_problem', i: number) => {
    setForm((f: any) => ({ ...f, [bucket]: f[bucket].filter((_: any, idx: number) => idx !== i) }));
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
    } catch (e) { console.log(e); }
    setCo(false);
  };

  const sectionDone: Record<string, boolean> = useMemo(() => ({
    plants: !!form.weather || form.plants_checked > 0 || !!form.harvest,
    maintenance: form.watering || form.weeding || form.pruning || !!form.fertilizer_type,
    pesticide: form.pesticide_used ? !!form.pesticide_details : true,
    cleaning: form.cleaning_done,
    drip: form.drip_ok || !!form.drip_notes,
    problems: !!form.problems,
    materials: !!form.materials_used,
    customer: form.customer_present || !!form.customer_feedback,
    summary: !!form.work_summary,
    photos: form.photos_before.length + form.photos_after.length + form.photos_problem.length > 0,
  }), [form]);

  const jump = (key: string) => {
    const y = sectionYs.current[key];
    if (y != null) scrollRef.current?.scrollTo({ y: y - 8, animated: true });
    setActiveSection(key);
    Haptics.selectionAsync().catch(() => {});
  };

  if (loading) return <SafeAreaView style={{ flex: 1 }}><ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.brandPrimary} /></SafeAreaView>;
  if (!setup) return <SafeAreaView style={{ flex: 1 }}><Header title="Visit" onBack={() => router.back()} /></SafeAreaView>;

  const captureY = (key: string) => (e: any) => { sectionYs.current[key] = e.nativeEvent.layout.y; };

  const SectionTitle = ({ k, title, icon }: { k: string; title: string; icon: keyof typeof Ionicons.glyphMap }) => (
    <View style={s.sectionTitle} onLayout={captureY(k)}>
      <View style={s.sectionIcon}>
        <Ionicons name={icon} size={18} color={theme.colors.brand} />
      </View>
      <Text style={s.sectionTitleTxt}>{title}</Text>
      {sectionDone[k] ? <Ionicons name="checkmark-circle" size={20} color={theme.colors.brandPrimary} /> : <View style={s.sectionDotEmpty} />}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <Header title={setup.customer_name} onBack={() => router.back()} />

      {/* Info banner */}
      <View style={s.banner}>
        <View style={{ flex: 1 }}>
          <Text style={s.bannerTitle}>{setup.setup_type} · {setup.maintenance_plan}</Text>
          <Text style={s.bannerAddr} numberOfLines={1}>{setup.address}</Text>
        </View>
        {visit ? (
          <View style={s.timer} testID="visit-timer">
            <Ionicons name="time-outline" size={14} color={theme.colors.brand} />
            <Text style={s.timerTxt}>{elapsed || '00:00:00'}</Text>
          </View>
        ) : null}
      </View>

      {!visit ? (
        <View style={{ padding: 32, alignItems: 'center', gap: 16 }}>
          <View style={s.hero}><Ionicons name="location" size={40} color={theme.colors.brand} /></View>
          <Text style={{ fontSize: theme.font.xl, fontWeight: '700', color: theme.colors.text, textAlign: 'center' }}>Ready to start?</Text>
          <Text style={{ color: theme.colors.text3, textAlign: 'center' }}>We'll record your GPS location and start the maintenance form.</Text>
          <View style={{ alignSelf: 'stretch', marginTop: 8 }}>
            <Button title="Check In" icon="location-outline" onPress={doCheckin} loading={ci} testID="checkin-btn" />
          </View>
        </View>
      ) : (
        <>
          {/* Section navigator */}
          <View style={s.navWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
              {SECTIONS.map((sec) => {
                const active = activeSection === sec.key;
                const done = sectionDone[sec.key];
                return (
                  <Pressable key={sec.key} onPress={() => jump(sec.key)} style={[s.navChip, active && s.navChipActive]} testID={`nav-${sec.key}`}>
                    {done ? <Ionicons name="checkmark" size={14} color={active ? '#fff' : theme.colors.brandPrimary} /> : null}
                    <Text style={[s.navChipTxt, active && { color: '#fff' }]}>{sec.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={insets.top}>
            <ScrollView
              ref={scrollRef}
              contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
              onScroll={(e) => {
                const y = e.nativeEvent.contentOffset.y;
                let current = 'plants';
                for (const sec of SECTIONS) {
                  if ((sectionYs.current[sec.key] ?? 0) - 40 <= y) current = sec.key;
                }
                if (current !== activeSection) setActiveSection(current);
              }}
              scrollEventThrottle={80}
            >
              {/* Plants */}
              <SectionTitle k="plants" title="Plants" icon="leaf-outline" />
              <Text style={s.subLabel}>Weather</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                {WEATHER.map(w => {
                  const active = form.weather === w;
                  return (
                    <Pressable key={w} onPress={() => setForm({ ...form, weather: w })} style={[s.chip, active && s.chipActive]} testID={`weather-${w}`}>
                      <Text style={[s.chipTxt, active && s.chipTxtActive]}>{w}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={s.rowSpread}><Text style={s.rowLabel}>Plants checked</Text><Stepper k="plants_checked" form={form} setForm={setForm} /></View>
              <View style={s.rowSpread}><Text style={s.rowLabel}>Plants dead</Text><Stepper k="plants_dead" form={form} setForm={setForm} /></View>
              <View style={s.rowSpread}><Text style={s.rowLabel}>Plants replaced</Text><Stepper k="plants_replaced" form={form} setForm={setForm} /></View>
              <View style={{ height: 12 }} />
              <Field label="New plantation" value={form.new_plantation} onChangeText={(v: string) => setForm({ ...form, new_plantation: v })} placeholder="e.g. 3 tomato saplings" />
              <View style={{ height: 12 }} />
              <Field label="Harvest" value={form.harvest} onChangeText={(v: string) => setForm({ ...form, harvest: v })} placeholder="e.g. 500g spinach" />

              {/* Maintenance */}
              <SectionTitle k="maintenance" title="Maintenance" icon="construct-outline" />
              <View style={{ gap: 8 }}>
                <Toggle label="Watering done" k="watering" icon="water" form={form} setForm={setForm} />
                <Toggle label="Weeding done" k="weeding" icon="cut" form={form} setForm={setForm} />
                <Toggle label="Pruning done" k="pruning" icon="leaf" form={form} setForm={setForm} />
              </View>
              <View style={{ height: 12 }} />
              <Field label="Fertilizer type" value={form.fertilizer_type} onChangeText={(v: string) => setForm({ ...form, fertilizer_type: v })} placeholder="e.g. Vermicompost" />
              <View style={{ height: 12 }} />
              <Field label="Fertilizer quantity" value={form.fertilizer_qty} onChangeText={(v: string) => setForm({ ...form, fertilizer_qty: v })} placeholder="e.g. 500g" />

              {/* Pesticide */}
              <SectionTitle k="pesticide" title="Pesticide" icon="flask-outline" />
              <Toggle label="Pesticide used" k="pesticide_used" icon="flask" form={form} setForm={setForm} />
              {form.pesticide_used ? (
                <>
                  <View style={{ height: 12 }} />
                  <Field label="Pesticide details" value={form.pesticide_details} onChangeText={(v: string) => setForm({ ...form, pesticide_details: v })} multiline placeholder="Name, dosage, area" />
                </>
              ) : null}

              {/* Cleaning */}
              <SectionTitle k="cleaning" title="Cleaning" icon="sparkles-outline" />
              <Toggle label="Cleaning done" k="cleaning_done" icon="sparkles" form={form} setForm={setForm} />

              {/* Drip */}
              <SectionTitle k="drip" title="Drip Irrigation" icon="water-outline" />
              <Toggle label="Drip lines OK" k="drip_ok" icon="checkmark-circle" form={form} setForm={setForm} />
              <View style={{ height: 12 }} />
              <Field label="Notes" value={form.drip_notes} onChangeText={(v: string) => setForm({ ...form, drip_notes: v })} multiline placeholder="Any leaks, clogs, adjustments" />

              {/* Problems */}
              <SectionTitle k="problems" title="Problems" icon="alert-circle-outline" />
              <Field label="Problems encountered" value={form.problems} onChangeText={(v: string) => setForm({ ...form, problems: v })} multiline placeholder="Pest attack, wilting, drainage issue…" />

              {/* Materials */}
              <SectionTitle k="materials" title="Materials Used" icon="cube-outline" />
              <Field label="Materials" value={form.materials_used} onChangeText={(v: string) => setForm({ ...form, materials_used: v })} multiline placeholder="Soil, compost, mulch, twine…" />

              {/* Customer */}
              <SectionTitle k="customer" title="Customer" icon="person-outline" />
              <Toggle label="Customer present" k="customer_present" icon="person" form={form} setForm={setForm} />
              <View style={{ height: 12 }} />
              <Field label="Feedback" value={form.customer_feedback} onChangeText={(v: string) => setForm({ ...form, customer_feedback: v })} multiline />
              <View style={{ height: 12 }} />
              <Field label="Complaints" value={form.customer_complaints} onChangeText={(v: string) => setForm({ ...form, customer_complaints: v })} multiline />

              {/* Summary */}
              <SectionTitle k="summary" title="Summary" icon="document-text-outline" />
              <Field label="Work summary" value={form.work_summary} onChangeText={(v: string) => setForm({ ...form, work_summary: v })} multiline placeholder="What did you accomplish today?" />
              <View style={{ height: 12 }} />
              <Field label="Next visit recommendation" value={form.next_visit_recommendation} onChangeText={(v: string) => setForm({ ...form, next_visit_recommendation: v })} multiline />

              {/* Photos */}
              <SectionTitle k="photos" title="Photos" icon="camera-outline" />
              <PhotoBucket label="Before" k="photos_before" form={form} pickImage={pickImage} removePhoto={removePhoto} />
              <View style={{ height: 16 }} />
              <PhotoBucket label="After" k="photos_after" form={form} pickImage={pickImage} removePhoto={removePhoto} />
              <View style={{ height: 16 }} />
              <PhotoBucket label="Problem" k="photos_problem" form={form} pickImage={pickImage} removePhoto={removePhoto} />
            </ScrollView>
          </KeyboardAvoidingView>

          <View style={[s.stickyCta, { paddingBottom: 16 + Math.max(insets.bottom - 8, 0) }]}>
            <Button title="Complete Maintenance" icon="checkmark-done" onPress={doCheckout} loading={co} testID="checkout-btn" />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border, backgroundColor: theme.colors.surface2 },
  bannerTitle: { fontWeight: '700', color: theme.colors.text, fontSize: theme.font.lg },
  bannerAddr: { color: theme.colors.text3, fontSize: theme.font.sm, marginTop: 2 },
  timer: { flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: theme.colors.brandSecondary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.pill },
  timerTxt: { color: theme.colors.brand, fontWeight: '700', fontSize: theme.font.sm, fontVariant: ['tabular-nums'] },
  hero: { width: 96, height: 96, borderRadius: 48, backgroundColor: theme.colors.brandSecondary, alignItems: 'center', justifyContent: 'center' },

  navWrap: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border, paddingVertical: 10, backgroundColor: '#fff' },
  navChip: { flexDirection: 'row', gap: 4, alignItems: 'center', height: 36, paddingHorizontal: 14, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.border, flexShrink: 0, backgroundColor: '#fff' },
  navChipActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  navChipTxt: { color: theme.colors.text2, fontWeight: '600', fontSize: theme.font.sm },

  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 28, marginBottom: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  sectionIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: theme.colors.brandSecondary, alignItems: 'center', justifyContent: 'center' },
  sectionTitleTxt: { fontSize: theme.font.xl, fontWeight: '700', color: theme.colors.text, flex: 1 },
  sectionDotEmpty: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: theme.colors.borderStrong },

  subLabel: { fontSize: theme.font.sm, color: theme.colors.text2, fontWeight: '600', marginBottom: 6 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  chipActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  chipTxt: { color: theme.colors.text2, fontWeight: '600', fontSize: theme.font.sm },
  chipTxtActive: { color: '#fff' },

  rowSpread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.divider },
  rowLabel: { color: theme.colors.text, fontSize: theme.font.base, fontWeight: '500' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 4 },
  stepBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  stepValue: { minWidth: 40, textAlign: 'center', fontWeight: '700', fontSize: theme.font.lg, color: theme.colors.text, padding: 0 },

  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, backgroundColor: '#fff' },
  toggleOn: { borderColor: theme.colors.brandPrimary, backgroundColor: theme.colors.brandSecondary + '60' },
  toggleIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: theme.colors.surface3, alignItems: 'center', justifyContent: 'center' },
  toggleIconOn: { backgroundColor: theme.colors.brandPrimary },
  toggleLabel: { flex: 1, color: theme.colors.text, fontSize: theme.font.base, fontWeight: '600' },
  switch: { width: 44, height: 26, borderRadius: 13, backgroundColor: theme.colors.surface3, justifyContent: 'center', padding: 3 },
  switchOn: { backgroundColor: theme.colors.brandPrimary },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  knobOn: { alignSelf: 'flex-end' },

  photo: { width: 84, height: 84, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surface3 },
  photoWrap: { position: 'relative' },
  photoRm: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: theme.colors.error, alignItems: 'center', justifyContent: 'center' },
  photoAdd: { width: 84, height: 84, borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface2 },

  stickyCta: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.98)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border, paddingHorizontal: 16, paddingTop: 12 },
});
