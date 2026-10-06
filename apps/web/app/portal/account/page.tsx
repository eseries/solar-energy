'use client';

import { useCallback, useEffect, useState } from 'react';
import { endpoints } from '../../../src/lib/api';
import type { Account, LedgerEntry } from '../../../src/lib/types';
import { ErrorMessage, PageTitle } from '../../../src/components/ui';

const pageSize = 20;
const transactionTypes = ['ALL', 'CREDIT', 'PAYMENT', 'REFUND', 'DEBIT', 'CHARGE', 'ADJUSTMENT'];

function money(value: number) { return `₦${value.toLocaleString()}`; }
function label(type: string) { return type.charAt(0) + type.slice(1).toLowerCase(); }

export default function Account() {
  const [account, setAccount] = useState<Account | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [accountBusy, setAccountBusy] = useState(true);
  const [ledgerBusy, setLedgerBusy] = useState(true);
  const [accountError, setAccountError] = useState('');
  const [ledgerError, setLedgerError] = useState('');
  const [type, setType] = useState('ALL');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<{ page: number; limit: number; total: number; totalPages: number }>();

  const loadAccount = useCallback(async () => {
    setAccountBusy(true); setAccountError('');
    try { setAccount(await endpoints.customerAccount()); }
    catch (e) { setAccountError(e instanceof Error ? e.message : 'Unable to load account information'); }
    finally { setAccountBusy(false); }
  }, []);

  const loadLedger = useCallback(async (requestedPage: number, selectedType = type, from = createdFrom, to = createdTo) => {
    setLedgerBusy(true); setLedgerError('');
    const params = new URLSearchParams({ page: String(requestedPage), limit: String(pageSize) });
    if (selectedType !== 'ALL') params.set('type', selectedType);
    if (from) params.set('createdFrom', from);
    if (to) params.set('createdTo', to);
    try {
      const result = await endpoints.customerLedger(`?${params.toString()}`);
      setEntries(result.data); setMeta(result.meta); setPage(result.meta?.page ?? requestedPage);
    } catch (e) { setLedgerError(e instanceof Error ? e.message : 'Unable to load transaction history'); }
    finally { setLedgerBusy(false); }
  }, [createdFrom, createdTo, type]);

  useEffect(() => { void loadAccount(); }, [loadAccount]);
  useEffect(() => { void loadLedger(1); }, [loadLedger]);

  const currentPage = meta?.page ?? page;
  const totalPages = meta?.totalPages ?? 1;
  const refresh = () => { void loadAccount(); void loadLedger(currentPage); };
  const applyFilters = (event: React.FormEvent) => { event.preventDefault(); void loadLedger(1); };

  return <>
    <PageTitle title="My account"><button className="rounded-lg border px-3 py-2 text-sm" onClick={refresh} disabled={accountBusy || ledgerBusy}>{accountBusy || ledgerBusy ? 'Refreshing…' : 'Refresh'}</button></PageTitle>
    <ErrorMessage message={accountError} />
    <section className="rounded-xl bg-white p-6 shadow-sm">
      <p className="text-sm text-slate-500">Current balance</p>
      {accountBusy ? <p className="mt-2 text-sm text-slate-500">Loading balance…</p> : account ? <p className="mt-2 text-4xl font-bold">{money(account.balance)}</p> : <p className="mt-2 text-sm text-slate-500">Balance unavailable.</p>}
    </section>
    {account && <section className="mt-4 rounded-xl bg-white p-5 text-sm shadow-sm"><h2 className="mb-3 font-semibold">Account information</h2><div className="grid gap-3 sm:grid-cols-2"><p>Created<br /><strong>{new Date(account.createdAt).toLocaleString()}</strong></p><p>Last updated<br /><strong>{new Date(account.updatedAt).toLocaleString()}</strong></p></div></section>}
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Transaction history</h2></div>
      <form onSubmit={applyFilters} className="mb-4 grid gap-3 rounded-xl bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm text-slate-600">Transaction type<select className="mt-1 w-full rounded-lg border px-3 py-2 text-slate-900" value={type} onChange={e => setType(e.target.value)}>{transactionTypes.map(value => <option key={value} value={value}>{value === 'ALL' ? 'All types' : label(value)}</option>)}</select></label>
        <label className="text-sm text-slate-600">From date<input className="mt-1 w-full rounded-lg border px-3 py-2 text-slate-900" type="date" value={createdFrom} onChange={e => setCreatedFrom(e.target.value)} /></label>
        <label className="text-sm text-slate-600">To date<input className="mt-1 w-full rounded-lg border px-3 py-2 text-slate-900" type="date" value={createdTo} onChange={e => setCreatedTo(e.target.value)} /></label>
        <div className="flex items-end gap-2"><button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white" type="submit" disabled={ledgerBusy}>Apply filters</button><button className="rounded-lg border px-4 py-2 text-sm" type="button" onClick={() => { setType('ALL'); setCreatedFrom(''); setCreatedTo(''); void loadLedger(1, 'ALL', '', ''); }} disabled={ledgerBusy}>Clear</button></div>
      </form>
      <ErrorMessage message={ledgerError} />
      {ledgerBusy ? <p className="text-sm text-slate-500">Loading transactions…</p> : entries.length ? <>
        <div className="space-y-3">{entries.map(entry => <article className="rounded-xl bg-white p-5 shadow-sm" key={entry.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><span className="font-semibold">{label(entry.type)}</span>{entry.description && <p className="mt-1 text-sm text-slate-600">{entry.description}</p>}</div><span className={`rounded-full px-2 py-1 text-xs font-medium ${['CREDIT', 'PAYMENT', 'REFUND'].includes(entry.type) ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{entry.type}</span></div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><p>Amount<br /><strong>{money(entry.amount)}</strong></p><p>Balance before<br /><strong>{money(entry.balanceBefore)}</strong></p><p>Balance after<br /><strong>{money(entry.balanceAfter)}</strong></p><p>Date<br /><strong>{new Date(entry.createdAt).toLocaleString()}</strong></p></div>{entry.reference && <p className="mt-3 text-xs text-slate-500">Reference: {entry.reference}</p>}</article>)}</div>
        {meta && <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm"><p className="text-slate-500">Page {currentPage} of {totalPages} · {meta.total} transactions</p><div className="flex gap-2"><button className="rounded-lg border px-3 py-2 disabled:opacity-50" disabled={ledgerBusy || currentPage <= 1} onClick={() => void loadLedger(currentPage - 1)}>Previous</button><button className="rounded-lg border px-3 py-2 disabled:opacity-50" disabled={ledgerBusy || currentPage >= totalPages} onClick={() => void loadLedger(currentPage + 1)}>Next</button></div></div>}
      </> : <p className="rounded-xl bg-white p-6 text-sm text-slate-500 shadow-sm">No account activity is available yet.</p>}
    </section>
  </>;
}
