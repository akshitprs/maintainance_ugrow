import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const API_URL = "https://maintainance-ugrow-api.onrender.com";

export async function setToken(v: string | null) {
  if (Platform.OS === 'web') {
    if (v == null) localStorage.removeItem('ugrow_token');
    else localStorage.setItem('ugrow_token', v);
  } else {
    if (v == null) await SecureStore.deleteItemAsync('ugrow_token');
    else await SecureStore.setItemAsync('ugrow_token', v);
  }
}
export async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem('ugrow_token');
  return await SecureStore.getItemAsync('ugrow_token');
}

async function req<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: any = { 'Content-Type': 'application/json', ...(init.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}/api${path}`, { ...init, headers });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j.detail || j.message || msg;
    } catch {}
    throw new Error(msg);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return (await res.text()) as any;
}

export const api = {
  login: async (email: string, password: string) => {
    const form = new URLSearchParams();
    form.append('username', email);
    form.append('password', password);
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.detail || 'Login failed');
    }
    return res.json();
  },
  me: () => req('/auth/me'),
  // Users
  listUsers: (role?: string) => req(`/users${role ? `?role=${role}` : ''}`),
  createUser: (b: any) => req('/users', { method: 'POST', body: JSON.stringify(b) }),
  updateUser: (id: string, b: any) => req(`/users/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
  deleteUser: (id: string) => req(`/users/${id}`, { method: 'DELETE' }),
  // Setups
  listSetups: () => req('/setups'),
  getSetup: (id: string) => req(`/setups/${id}`),
  createSetup: (b: any) => req('/setups', { method: 'POST', body: JSON.stringify(b) }),
  updateSetup: (id: string, b: any) => req(`/setups/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
  deleteSetup: (id: string) => req(`/setups/${id}`, { method: 'DELETE' }),
  // Visits
  checkin: (setup_id: string, lat?: number, lng?: number) =>
    req('/visits/checkin', { method: 'POST', body: JSON.stringify({ setup_id, lat, lng }) }),
  checkout: (id: string, form: any, lat?: number, lng?: number) =>
    req(`/visits/${id}/checkout`, { method: 'POST', body: JSON.stringify({ form, lat, lng }) }),
  listVisits: (params: Record<string, any> = {}) => {
    const q = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(v as any)}`)
      .join('&');
    return req(`/visits${q ? `?${q}` : ''}`);
  },
  getVisit: (id: string) => req(`/visits/${id}`),
  rate: (id: string, stars: number, comment: string) =>
    req(`/visits/${id}/rate`, { method: 'POST', body: JSON.stringify({ stars, comment }) }),
  dashboard: () => req('/dashboard/stats'),
  notifications: () => req('/notifications'),
  readNotif: (id: string) => req(`/notifications/${id}/read`, { method: 'POST' }),
  readAll: () => req('/notifications/read-all', { method: 'POST' }),
  reportsUrl: (params: Record<string, any>) => {
    const q = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(v as any)}`)
      .join('&');
    return `${API_URL}/api/reports/visits${q ? `?${q}` : ''}`;
  },
  singleVisitPdfUrl: (id: string) => `${API_URL}/api/visits/${id}/export?format=pdf`,
};

export { API_URL };

// ---------- Time helpers ----------
export function fmtDateTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
  return `${date}, ${time}`;
}
export function fmtDateTimeSec(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).toLowerCase();
  return `${date}, ${time}`;
}
export function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function fmtTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
}
