"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PackagePlus, ShoppingCart, AlertCircle, TrendingUp, TrendingDown, RefreshCw, Download, Search, Calendar } from 'lucide-react';
import { fetchStockMovements, type StockMovementRow } from '@/app/pos/actions';

export type SnapshotProduct = {
  name: string;
  sku?: string;
  category?: string;
  stock: number;
  alertAt?: number;
  price?: number;
};

type MoveType = 'RESTOCK' | 'SALE' | 'RETURN' | 'DAMAGE' | 'CORRECTION';
type Range = 'all' | 'today' | 'week' | 'month' | 'custom';

const TYPE_META: Record<MoveType, { label: string; cls: string }> = {
  RESTOCK: { label: 'Restock', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  SALE: { label: 'Sale', cls: 'border-[#A4164E]/25 bg-[#FFF7EE] text-[#A4164E]' },
  RETURN: { label: 'Return', cls: 'border-blue-200 bg-blue-50 text-blue-700' },
  DAMAGE: { label: 'Lost / Damaged', cls: 'border-orange-200 bg-orange-50 text-orange-700' },
  CORRECTION: { label: 'Count', cls: 'border-gray-200 bg-gray-100 text-gray-700' },
};

/** Reasons are stored as "sale" or "TYPE: note" by the billing and adjustment screens. */
const parseReason = (reason: string, adjustment: number): { type: MoveType; note: string } => {
  const raw = (reason || '').trim();
  if (/^sale$/i.test(raw)) return { type: 'SALE', note: '' };
  const m = /^(RESTOCK|DAMAGE|RETURN|CORRECTION)\s*:\s*(.*)$/i.exec(raw);
  if (m) {
    const note = m[2].trim();
    return { type: m[1].toUpperCase() as MoveType, note: note === 'Manual stock adjustment' ? '' : note };
  }
  return { type: adjustment >= 0 ? 'RESTOCK' : 'DAMAGE', note: raw };
};

const startOf = (range: Range): Date | null => {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === 'today') return d;
  if (range === 'week') { d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; } // Monday
  if (range === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  return null;
};

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const downloadCsv = (filename: string, header: string[], rows: unknown[][]) => {
  const body = [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const today = () => new Date().toISOString().slice(0, 10);

export default function StockMovements({ products = [] }: { products?: SnapshotProduct[] }) {
  const [rows, setRows] = useState<StockMovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>('all');
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | MoveType>('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchStockMovements());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const parsed = useMemo(() => rows.map(r => ({ ...r, ...parseReason(r.reason, r.adjustment) })), [rows]);

  const inRange = useMemo(() => {
    if (range === 'custom') {
      const a = new Date(`${from}T00:00:00`).getTime();
      const b = new Date(`${to}T23:59:59.999`).getTime();
      return parsed.filter(r => { const t = new Date(r.created_at).getTime(); return t >= a && t <= b; });
    }
    const start = startOf(range);
    return start ? parsed.filter(r => new Date(r.created_at) >= start) : parsed;
  }, [parsed, range, from, to]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inRange.filter(r => {
      if (typeFilter !== 'ALL' && r.type !== typeFilter) return false;
      if (!q) return true;
      return [r.product_name, r.reference_id, r.note].some(v => (v || '').toLowerCase().includes(q));
    });
  }, [inRange, search, typeFilter]);

  const stats = useMemo(() => {
    let incoming = 0, sold = 0, lost = 0, net = 0;
    for (const r of inRange) {
      net += r.adjustment;
      if (r.type === 'SALE') sold += -r.adjustment;
      else if (r.type === 'DAMAGE') lost += -r.adjustment;
      else if (r.adjustment > 0) incoming += r.adjustment;
    }
    return { incoming, sold, lost, net };
  }, [inRange]);

  const exportMovements = () =>
    downloadCsv(
      `stock-movements-${today()}.csv`,
      ['Date & Time', 'Product', 'Type', 'Change', 'Stock Before', 'Stock After', 'Reference', 'Note'],
      visible.map(r => [fmtDateTime(r.created_at), r.product_name, TYPE_META[r.type].label, r.adjustment, r.old_quantity, r.new_quantity, r.reference_id, r.note]),
    );

  const exportSnapshot = () =>
    downloadCsv(
      `stock-snapshot-${today()}.csv`,
      ['Product', 'SKU', 'Category', 'Stock', 'Low Stock Alert', 'Status'],
      products.map(p => [p.name, p.sku, p.category, p.stock, p.alertAt, p.stock <= 0 ? 'Out of stock' : p.alertAt !== undefined && p.stock <= p.alertAt ? 'Low stock' : 'In stock']),
    );

  const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

  const cards = [
    { label: 'Incoming Stock', value: signed(stats.incoming), Icon: PackagePlus, box: 'bg-emerald-50 text-emerald-600 border-emerald-200', text: 'text-emerald-700' },
    { label: 'Units Sold (POS)', value: String(stats.sold), Icon: ShoppingCart, box: 'bg-[#FFF7EE] text-[#A4164E] border-[#A4164E]/25', text: 'text-[#A4164E]' },
    { label: 'Lost / Damaged', value: String(stats.lost), Icon: AlertCircle, box: 'bg-orange-50 text-orange-600 border-orange-200', text: 'text-orange-600' },
    { label: 'Net Stock Change', value: signed(stats.net), Icon: stats.net < 0 ? TrendingDown : TrendingUp, box: 'bg-[#A4164E] text-white border-[#A4164E]', text: 'text-[#111111]' },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div>
        <h2 className="text-[28px] font-black tracking-tight text-black">Stock Movements</h2>
        <p className="mt-1 text-xs font-semibold text-black">
          Every change to stock — restocks, sales, returns, losses and counts — with before and after levels.
        </p>
      </div>

      {/* RANGE + EXPORTS */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
          {([['all', 'All Time'], ['today', 'Today'], ['week', 'This Week'], ['month', 'This Month']] as [Range, string][]).map(([k, label]) => (
            <button key={k} onClick={() => setRange(k)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${range === k ? 'bg-[#A4164E] text-white shadow-sm' : 'text-black hover:bg-white'}`}>
              {label}
            </button>
          ))}
          <button onClick={() => setRange('custom')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${range === 'custom' ? 'bg-[#A4164E] text-white shadow-sm' : 'text-black hover:bg-white'}`}>
            <Calendar size={13} /> Custom Range
          </button>
          {range === 'custom' && (
            <span className="flex items-center gap-1.5 px-1">
              <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold" />
              <span className="text-xs text-gray-500">to</span>
              <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold" />
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => void load()} disabled={loading} title="Refresh"
            className="rounded-lg border border-gray-200 bg-white p-2 text-black hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={exportSnapshot}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-emerald-700 hover:bg-emerald-100">
            <Download size={14} /> Stock Snapshot CSV
          </button>
          <button onClick={exportMovements}
            className="flex items-center gap-1.5 rounded-lg bg-[#A4164E] px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white hover:brightness-95">
            <Download size={14} /> Movements CSV
          </button>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(c => (
          <div key={c.label} className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-5 shadow-sm">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${c.box}`}>
              <c.Icon size={20} />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-800">{c.label}</p>
              <p className={`text-xl font-black ${c.text}`}>
                {c.value} <span className="text-sm font-bold">Units</span>
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* LEDGER */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50/60 px-4 py-3">
          <h3 className="text-sm font-black uppercase tracking-wider text-black">Movement Audit Ledger ({visible.length})</h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product, bill no. or note..."
                className="w-64 max-w-full rounded-lg border border-gray-200 bg-white py-2 pl-8 pr-3 text-xs font-semibold outline-none focus:border-[#A4164E]" />
            </div>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as 'ALL' | MoveType)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-[#A4164E]">
              <option value="ALL">All Types</option>
              {(Object.keys(TYPE_META) as MoveType[]).map(t => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
            </select>
          </div>
        </div>

        <div className="max-h-[36rem] overflow-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-black">
                <th className="px-4 py-3">Date &amp; Time</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Change</th>
                <th className="px-4 py-3 text-right">Stock Level</th>
                <th className="px-4 py-3">Reference / Note</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(r => (
                <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-700">{fmtDateTime(r.created_at)}</td>
                  <td className="px-4 py-3 font-bold text-black">{r.product_name}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${TYPE_META[r.type].cls}`}>
                      {TYPE_META[r.type].label}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-black ${r.adjustment > 0 ? 'text-emerald-600' : r.adjustment < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                    {signed(r.adjustment)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-black">
                    {r.old_quantity ?? '—'} → {r.new_quantity ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-600">
                    {[r.reference_id, r.note].filter(Boolean).join(' · ') || '—'}
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm font-medium text-gray-500">
                    {loading ? 'Loading movements…' : 'No stock movements in this period.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
