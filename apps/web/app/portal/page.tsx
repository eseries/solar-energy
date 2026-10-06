'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { endpoints } from '../../src/lib/api';
import type { Account, Bill, Customer, Notification, Payment, Reading } from '../../src/lib/types';
import { Button, ErrorMessage, PageTitle } from '../../src/components/ui';

const money = (value: number, currency = 'NGN') => `${currency === 'NGN' ? '₦' : `${currency} `}${value.toLocaleString()}`;
const date = (value?: string | null) => value ? new Date(value).toLocaleString() : 'Not available';

function SectionError({ message }: { message?: string }) { return message ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{message}</p> : null; }

export default function Portal() {
  const [profile, setProfile] = useState<Customer | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paying, setPaying] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setErrors({});
    const requests = await Promise.allSettled([
      endpoints.customerMe(), endpoints.customerAccount(), endpoints.customerBills('?limit=5'),
      endpoints.customerPayments('?limit=5'), endpoints.customerReadings('?limit=5'), endpoints.customerNotifications(),
    ]);
    const [profileResult, accountResult, billsResult, paymentsResult, readingsResult, notificationsResult] = requests;
    const values = [profileResult, accountResult, billsResult, paymentsResult, readingsResult, notificationsResult];
    const keys = ['profile', 'account', 'bills', 'payments', 'readings', 'notifications'];
    const nextErrors: Record<string, string> = {};
    values.forEach((result, index) => { if (result.status === 'rejected') nextErrors[keys[index]] = result.reason instanceof Error ? result.reason.message : 'Unable to load this section'; });
    if (profileResult.status === 'fulfilled') setProfile(profileResult.value);
    if (accountResult.status === 'fulfilled') setAccount(accountResult.value);
    if (billsResult.status === 'fulfilled') setBills(billsResult.value.data);
    if (paymentsResult.status === 'fulfilled') setPayments(paymentsResult.value.data);
    if (readingsResult.status === 'fulfilled') setReadings(readingsResult.value.data);
    if (notificationsResult.status === 'fulfilled') setNotifications(notificationsResult.value);
    setErrors(nextErrors); setLoading(false); setRefreshing(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function pay(billId: string) {
    setPaying(billId); setErrors(current => ({ ...current, payment: '' }));
    try { const result = await endpoints.initializePayment(billId) as { authorizationUrl?: string }; if (result.authorizationUrl) window.location.href = result.authorizationUrl; else setErrors(current => ({ ...current, payment: 'Payment initialized without a checkout URL.' })); }
    catch (e) { setErrors(current => ({ ...current, payment: e instanceof Error ? e.message : 'Unable to initialize payment' })); }
    finally { setPaying(''); }
  }

  const latestReadingByMeter = readings.reduce<Record<string, Reading>>((result, reading) => { const key = reading.meterId; if (!result[key] || new Date(reading.readingAt) > new Date(result[key].readingAt)) result[key] = reading; return result; }, {});
  const latestBills = bills[0]; const latestPayment = payments[0]; const unread = notifications.filter(notification => notification.status !== 'READ');

  return <>
    <PageTitle title={profile ? `Welcome, ${profile.name}` : 'Customer portal'}><Button onClick={() => void load(true)} disabled={loading || refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</Button></PageTitle>
    <ErrorMessage message={errors.profile} />
    {loading && !profile ? <p className="text-sm text-slate-500">Loading your overview…</p> : <>
      {profile && <section className="mb-6 rounded-xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Customer</p><div className="mt-1 flex flex-wrap items-center gap-3"><h2 className="text-xl font-semibold">{profile.name}</h2><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium">{profile.customerNumber}</span><span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">{profile.status}</span></div></section>}
      <div className="grid gap-4 sm:grid-cols-2"><section className="rounded-xl bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-semibold">Account balance</h2><Link className="text-sm text-emerald-700 hover:underline" href="/portal/account">View account</Link></div>{errors.account ? <SectionError message={errors.account} /> : account ? <p className="mt-3 text-3xl font-bold">{money(account.balance)}</p> : <p className="mt-3 text-sm text-slate-500">Account balance unavailable.</p>}</section><section className="rounded-xl bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-semibold">Notifications</h2><Link className="text-sm text-emerald-700 hover:underline" href="/portal/notifications">View all</Link></div>{errors.notifications ? <SectionError message={errors.notifications} /> : unread.length ? <p className="mt-3 text-sm">{unread.length} unread notification{unread.length === 1 ? '' : 's'}</p> : <p className="mt-3 text-sm text-slate-500">No unread notifications.</p>}</section></div>
      <section className="mt-6 rounded-xl bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-semibold">My meters</h2><Link className="text-sm text-emerald-700 hover:underline" href="/portal/consumption">View consumption</Link></div>{errors.profile ? null : profile?.meters?.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{profile.meters.map(meter => <div className="rounded-lg border p-4" key={meter.id}><p className="font-medium">{meter.meterNumber}</p><p className="text-sm text-slate-500">{meter.meterType} · {meter.status}</p>{latestReadingByMeter[meter.id] && <p className="mt-2 text-sm text-slate-600">Latest: {latestReadingByMeter[meter.id].currentReading ?? latestReadingByMeter[meter.id].reading} on {date(latestReadingByMeter[meter.id].readingAt)}</p>}</div>)}</div> : <p className="mt-3 text-sm text-slate-500">No meters assigned.</p>}</section>
      <div className="mt-6 grid gap-6 lg:grid-cols-2"><section className="rounded-xl bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-semibold">Recent bill</h2><Link className="text-sm text-emerald-700 hover:underline" href="/portal/bills">View bills</Link></div>{errors.bills ? <SectionError message={errors.bills} /> : latestBills ? <div className="mt-4 text-sm"><Link href={`/portal/bills/${latestBills.id}`} className="font-medium text-emerald-700 hover:underline">{latestBills.billNumber}</Link><p className="mt-1 text-slate-500">{new Date(latestBills.billingPeriodStart).toLocaleDateString()} – {new Date(latestBills.billingPeriodEnd).toLocaleDateString()}</p><p className="mt-1">{money(latestBills.amount)} · {latestBills.status}</p>{latestBills.dueDate && <p className="mt-1 text-slate-500">Due {new Date(latestBills.dueDate).toLocaleDateString()}</p>}{latestBills.status !== 'PAID' && <Button className="mt-4" disabled={paying === latestBills.id} onClick={() => void pay(latestBills.id)}>{paying === latestBills.id ? 'Starting…' : 'Pay bill'}</Button>}{errors.payment && <SectionError message={errors.payment} />}</div> : <p className="mt-3 text-sm text-slate-500">No bills available.</p>}</section><section className="rounded-xl bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-semibold">Recent payment</h2><Link className="text-sm text-emerald-700 hover:underline" href="/portal/payments">View payments</Link></div>{errors.payments ? <SectionError message={errors.payments} /> : latestPayment ? <div className="mt-4 text-sm"><Link href={`/portal/payments/${latestPayment.id}`} className="font-medium text-emerald-700 hover:underline">{latestPayment.reference}</Link><p className="mt-1">{money(latestPayment.amount, latestPayment.currency)} · {latestPayment.status}</p><p className="mt-1 text-slate-500">{date(latestPayment.paidAt ?? latestPayment.createdAt)}</p></div> : <p className="mt-3 text-sm text-slate-500">No payments available.</p>}</section></div>
      <section className="mt-6 rounded-xl bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-semibold">Latest consumption</h2><Link className="text-sm text-emerald-700 hover:underline" href="/portal/consumption">View history</Link></div>{errors.readings ? <SectionError message={errors.readings} /> : readings.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{Object.values(latestReadingByMeter).map(reading => <div className="rounded-lg border p-4" key={reading.id}><p className="font-medium">{reading.meter?.meterNumber ?? 'Meter'}</p><p className="mt-1 text-sm text-slate-500">Reading date: {date(reading.readingAt)}</p><p className="mt-2 text-sm">Current: <strong>{reading.currentReading ?? reading.reading}</strong></p><p className="text-sm">Usage: <strong>{reading.consumptionKwh == null ? 'First recorded reading' : `${reading.consumptionKwh.toLocaleString()} kWh`}</strong></p></div>)}</div> : <p className="mt-3 text-sm text-slate-500">No readings available.</p>}</section>
      <section className="mt-6"><h2 className="mb-3 font-semibold">Quick actions</h2><div className="flex flex-wrap gap-3">{[['Bills', '/portal/bills'], ['Payments', '/portal/payments'], ['Consumption', '/portal/consumption'], ['Account', '/portal/account'], ['Notifications', '/portal/notifications']].map(([name, href]) => <Link className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:border-emerald-500 hover:text-emerald-700" href={href} key={href}>{name}</Link>)}</div></section>
    </>}
  </>;
}
