import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { theme } from '@/src/theme';
import { api } from '@/src/api';
import { Header, Field, Button } from '@/src/ui';

const SETUP_TYPES = ['Terrace Garden', 'Circular Grow Bags', 'Rectangular Grow Bed', 'Ground Kitchen Garden', 'Landscaping'];
const PLANS = ['Self', 'Monthly', 'Premium'];

export default function SetupForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [form, setForm] = useState<any>({
    customer_name: '',
    mobile: '',
    address: '',
    gmap_link: '',
    setup_type: 'Terrace Garden',
    installation_date: '',
    maintenance_plan: 'Monthly',
    assigned_employee_id: '',
    status: 'active',
  });

  useEffect(() => {
    api.listUsers('employee').then(setEmployees).catch(() => {});
    if (!isNew) {
      api.getSetup(id).then(s => { setForm({ ...form, ...s, assigned_employee_id: s.assigned_employee_id || '' }); setLoading(false); }).catch(() => setLoading(false));
    }
  }, [id]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      if (isNew) await api.createSetup(payload);
      else await api.updateSetup(id, payload);
      router.back();
    } catch (e: any) {
      console.log(e);
    }
    setSaving(false);
  };

  const remove = async () => {
    if (!isNew) {
      await api.deleteSetup(id);
      router.back();
    }
  };

  if (loading) return <SafeAreaView style={{ flex: 1 }}><ActivityIndicator color={theme.colors.brandPrimary} style={{ marginTop: 40 }} /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'bottom']}>
      <Header title={isNew ? 'New Setup' : 'Edit Setup'} onBack={() => router.back()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>
          <Field label="Customer name" value={form.customer_name} onChangeText={(v: string) => setForm({ ...form, customer_name: v })} testID="setup-customer" />
          <Field label="Mobile" value={form.mobile} onChangeText={(v: string) => setForm({ ...form, mobile: v })} keyboardType="phone-pad" testID="setup-mobile" />
          <Field label="Address" value={form.address} onChangeText={(v: string) => setForm({ ...form, address: v })} multiline testID="setup-address" />
          <Field label="Google Maps link" value={form.gmap_link} onChangeText={(v: string) => setForm({ ...form, gmap_link: v })} autoCapitalize="none" />

          <View>
            <Text style={s.label}>Setup type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {SETUP_TYPES.map(t => (
                <Pressable key={t} onPress={() => setForm({ ...form, setup_type: t })} style={[s.chip, form.setup_type === t && s.chipActive]}>
                  <Text style={[s.chipTxt, form.setup_type === t && s.chipTxtActive]}>{t}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <Field label="Installation date (YYYY-MM-DD)" value={form.installation_date} onChangeText={(v: string) => setForm({ ...form, installation_date: v })} />

          <View>
            <Text style={s.label}>Maintenance plan</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {PLANS.map(p => (
                <Pressable key={p} onPress={() => setForm({ ...form, maintenance_plan: p })} style={[s.chip, form.maintenance_plan === p && s.chipActive, { flex: 1, alignItems: 'center' }]}>
                  <Text style={[s.chipTxt, form.maintenance_plan === p && s.chipTxtActive]}>{p}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View>
            <Text style={s.label}>Assign employee</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <Pressable onPress={() => setForm({ ...form, assigned_employee_id: '' })} style={[s.chip, !form.assigned_employee_id && s.chipActive]}>
                <Text style={[s.chipTxt, !form.assigned_employee_id && s.chipTxtActive]}>None</Text>
              </Pressable>
              {employees.map((e: any) => (
                <Pressable key={e.id} onPress={() => setForm({ ...form, assigned_employee_id: e.id })} style={[s.chip, form.assigned_employee_id === e.id && s.chipActive]}>
                  <Text style={[s.chipTxt, form.assigned_employee_id === e.id && s.chipTxtActive]}>{e.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <Button title={isNew ? 'Create Setup' : 'Save Changes'} onPress={save} loading={saving} testID="setup-save" />
          {!isNew && <Button title="Delete Setup" onPress={remove} variant="danger" testID="setup-delete" />}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  label: { fontSize: theme.font.sm, color: theme.colors.text2, fontWeight: '600', marginBottom: 8 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  chipActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  chipTxt: { color: theme.colors.text2, fontWeight: '600', fontSize: theme.font.sm },
  chipTxtActive: { color: '#fff' },
});
