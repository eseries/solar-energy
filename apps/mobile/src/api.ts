import type { Account, AuthResponse, Bill, Customer, LedgerEntry, Notification, Page, Payment, Reading, User } from '@solar-energy/shared';
import * as SecureStore from 'expo-secure-store';

const baseUrl = process.env.EXPO_PUBLIC_API_URL;
if (!baseUrl) console.warn('EXPO_PUBLIC_API_URL is not set. Configure it in apps/mobile/.env.');
const tokenKey = 'solar_access_token';
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export const tokenStore = { get: () => SecureStore.getItemAsync(tokenKey), set: (v: string) => SecureStore.setItemAsync(tokenKey, v), clear: () => SecureStore.deleteItemAsync(tokenKey) };
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers); headers.set('Accept', 'application/json');
  if (options.body) headers.set('Content-Type', 'application/json');
  const token = await tokenStore.get(); if (token) headers.set('Authorization', `Bearer ${token}`);
  let response: Response; try { response = await fetch(`${baseUrl ?? ''}${path}`, { ...options, headers }); } catch { throw new ApiError(0, 'Unable to reach the API. Check EXPO_PUBLIC_API_URL and the backend.'); }
  const body = await response.json().catch(() => null);
  if (!response.ok) { const message = body?.message; throw new ApiError(response.status, Array.isArray(message) ? message.join(', ') : message || 'The request failed.'); }
  return body as T;
}
const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) });
const patch = <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
export const authApi = { login: (email: string, password: string) => post<AuthResponse>('/auth/login', { email, password }), me: () => get<User>('/auth/me') };
export const customerApi = {
  profile: () => get<Customer>('/customer/me'), account: () => get<Account>('/customer/me/account'),
  bills: () => get<Page<Bill>>('/customer/me/bills'), bill: (id: string) => get<Bill>(`/customer/me/bills/${id}`), initializePayment: (billId: string) => post<{ reference: string; authorizationUrl: string; accessCode: string }>('/payments/initialize', { billId }), payments: () => get<Page<Payment>>('/customer/me/payments'), payment: (id: string) => get<Payment>(`/customer/me/payments/${id}`),
  ledger: (query = '') => get<Page<LedgerEntry>>(`/customer/me/ledger${query}`), readings: (query = '') => get<Page<Reading>>(`/customer/me/readings${query}`)
  , notifications: () => get<Notification[]>('/notifications'), markNotificationRead: (id: string) => patch<Notification>(`/notifications/${id}/read`, {})
};
