import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { theme } from '@/src/theme';
import { api } from '@/src/api';
import { Header, Field, Button } from '@/src/ui';

export default function EmployeeForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<any>({ name: '', email: '', password: '', mobile: '', address: '', status: 'active', joining_date: '' });

  useEffect(() => {
    if (!isNew) {
      api.listUsers('employee').then(rows => {
        const u = rows.find((r: any) => r.id === id);
        if (u) setF({ ...f, ...u, password: '' });
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [id]);

  const save = async () => {
    setSaving(true);
    try {
      if (isNew) {
        await api.createUser({ ...f, role: 'employee' });
      } else {
        const upd: any = { ...f };
        if (!upd.password) delete upd.password;
        delete upd.email; delete upd.role; delete upd.id;
        await api.updateUser(id, upd);
      }
      router.back();
    } catch (e: any) {
      console.log(e);
    }
    setSaving(false);
  };

  const toggleStatus = async () => {
    if (isNew) return;
    const newStatus = f.status === 'active' ? 'inactive' : 'active';
    await api.updateUser(id, { status: newStatus });
    setF({ ...f, status: newStatus });
  };

  const remove = async () => {
    if (isNew) return;
    await api.deleteUser(id);
    router.back();
  };

  if (loading) return <SafeAreaView style={{ flex: 1 }}><ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.brandPrimary} /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'bottom']}>
      <Header title={isNew ? 'New Employee' : 'Edit Employee'} onBack={() => router.back()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>
          <Field label="Full name" value={f.name} onChangeText={(v: string) => setF({ ...f, name: v })} testID="emp-name" />
          <Field label="Email" value={f.email} onChangeText={(v: string) => setF({ ...f, email: v })} autoCapitalize="none" keyboardType="email-address" testID="emp-email" />
          <Field label={isNew ? 'Password' : 'New password (optional)'} value={f.password} onChangeText={(v: string) => setF({ ...f, password: v })} secureTextEntry testID="emp-password" />
          <Field label="Mobile" value={f.mobile} onChangeText={(v: string) => setF({ ...f, mobile: v })} keyboardType="phone-pad" />
          <Field label="Address" value={f.address} onChangeText={(v: string) => setF({ ...f, address: v })} multiline />
          <Field label="Joining date" value={f.joining_date} onChangeText={(v: string) => setF({ ...f, joining_date: v })} placeholder="YYYY-MM-DD" />

          <Button title={isNew ? 'Create Employee' : 'Save Changes'} onPress={save} loading={saving} testID="emp-save" />
          {!isNew && (
            <>
              <Button title={f.status === 'active' ? 'Deactivate' : 'Activate'} onPress={toggleStatus} variant="outline" testID="emp-toggle-status" />
              <Button title="Delete Employee" onPress={remove} variant="danger" testID="emp-delete" />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
