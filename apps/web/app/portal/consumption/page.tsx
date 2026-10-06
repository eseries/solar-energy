'use client';

import { useCallback, useEffect, useState } from 'react';
import { endpoints } from '../../../src/lib/api';
import type { Reading } from '../../../src/lib/types';
import { ErrorMessage, PageTitle } from '../../../src/components/ui';

const pageSize = 20;
function readingValue(value: number | null | undefined) { return value == null ? '—' : value.toLocaleString(); }

export default function Consumption() {
  const [items, setItems] = useState<Reading[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<{ page: number; limit: number; total: number; totalPages: number }>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const load = useCallback(async (requestedPage: number) => {
    setBusy(true); setError('');
    try {
      const result = await endpoints.customerReadings(`?page=${requestedPage}&limit=${pageSize}`);
      setItems(result.data); setMeta(result.meta); setPage(result.meta?.page ?? requestedPage);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load consumption history'); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(1); }, [load]);
  const totalPages = meta?.totalPages ?? 1; const currentPage = meta?.page ?? page;
  return <>
    <PageTitle title="Consumption"><button className="rounded-lg border px-3 py-2 text-sm" onClick={() => void load(currentPage)} disabled={busy}>{busy ? 'Refreshing…' : 'Refresh'}</button></PageTitle>
    <ErrorMessage message={error} />
    {busy ? <p className="text-sm text-slate-500">Loading readings…</p> : items.length ? <>
      <div className="space-y-4">{items.map((reading) => <article className="rounded-xl bg-white p-5 shadow-sm" key={reading.id}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{reading.meter?.meterNumber ?? 'Meter reading'}</h2><p className="text-sm text-slate-500">{new Date(reading.readingAt).toLocaleString()}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium">{reading.source}</span></div>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><p>Previous reading<br /><strong>{readingValue(reading.previousReading)}</strong></p><p>Current reading<br /><strong>{readingValue(reading.currentReading ?? reading.reading)}</strong></p><p>Usage<br /><strong>{reading.consumptionKwh == null ? 'First recorded reading' : `${readingValue(reading.consumptionKwh)} kWh`}</strong></p></div>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">{reading.meter?.meterType && <span>Type: {reading.meter.meterType}</span>}{reading.meter?.status && <span>Status: {reading.meter.status}</span>}<span>Recorded: {new Date(reading.createdAt).toLocaleString()}</span></div>
      </article>)}</div>
      {meta && <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm"><p className="text-slate-500">Page {currentPage} of {totalPages} · {meta.total} readings</p><div className="flex gap-2"><button className="rounded-lg border px-3 py-2 disabled:opacity-50" disabled={busy || currentPage <= 1} onClick={() => void load(currentPage - 1)}>Previous</button><button className="rounded-lg border px-3 py-2 disabled:opacity-50" disabled={busy || currentPage >= totalPages} onClick={() => void load(currentPage + 1)}>Next</button></div></div>}
    </> : <p className="rounded-xl bg-white p-6 text-sm text-slate-500 shadow-sm">No consumption readings available.</p>}
  </>;
}
