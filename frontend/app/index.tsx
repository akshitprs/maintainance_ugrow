import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/src/auth';
import { theme } from '@/src/theme';

export default function Index() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator color={theme.colors.brandPrimary} />
      </View>
    );
  }
  if (!user) return <Redirect href="/login" />;
  if (user.role === 'admin') return <Redirect href="/(admin)/(tabs)/dashboard" />;
  return <Redirect href="/(employee)/(tabs)/home" />;
}
