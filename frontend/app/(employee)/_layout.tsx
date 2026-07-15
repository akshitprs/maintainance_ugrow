import { Stack } from 'expo-router';

export default function EmployeeStack() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#fff' } }} />;
}
