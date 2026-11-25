"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Cake, UserPlus, ChevronLeft, ChevronRight, Gift, Pencil, Trash2, Plus, Save, MessageCircle, Download, X, Search } from 'lucide-react';
import {
  fetchBirthdayCustomers,
  saveCustomerBirthday,
  fetchBirthdayOffers,
  saveBirthdayOffer,
  deleteBirthdayOffer,
  fetchBirthdayMessage,
  saveBirthdayMessage,
  type BirthdayCustomer,
  type BirthdayOffer,
} from '@/app/pos/birthdayActions';
import { BRAND_EN, BRAND_PHONE_DISPLAY, BRAND_INSTAGRAM } from '@/lib/brand';
import { whatsappUrl } from '@/lib/whatsapp';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT = MONTHS.map(m => m.slice(0, 3));

const DEFAULT_MESSAGE = `Hi {name}! 🎂 Happy Birthday!

Here's a special treat from {shop}:
🎁 {offer}

Visit us in store or call {phone}.
Follow us on Instagram @{instagram}`;

type Tab = 'calendar' | 'customers' | 'none';
type Preset = 'today' | 'week' | 'month' | 'all' | 'custom';
type MD = { m: number; d: number }; // m: 1-12

const daysIn = (m: number) => new Date(2024, m, 0).getDate(); // leap year so Feb has 29
const mdKey = ({ m, d }: MD) => m * 100 + d;
const mdOf = (iso: string): MD => ({ m: Number(iso.slice(5, 7)), d: Number(iso.slice(8, 10)) });
const mdFromDate = (dt: Date): MD => ({ m: dt.getMonth() + 1, d: dt.getDate() });

/** Is month/day inside [from, to]? Handles ranges that wrap past New Year. */
const inRange = (x: MD, from: MD, to: MD) => {
  const k = mdKey(x), a = mdKey(from), b = mdKey(to);
  return a <= b ? k >= a && k <= b : k >= a || k <= b;
};

/** Days until the next occurrence of this birthday (0 = today). */
const daysUntil = (x: MD) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), x.m - 1, x.d);
  if (next < today) next = new Date(now.getFullYear() + 1, x.m - 1, x.d);
  return Math.round((next.getTime() - today.getTime()) / 86400000);
};

const fmtBirthday = (iso: string) => `${Number(iso.slice(8, 10))} ${SHORT[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const turningAge = (iso: string, x: MD) => {
  const year = Number(iso.slice(0, 4));
  if (!year || year < 1900) return null;
  const now = new Date();
  const thisYear = new Date(now.getFullYear(), x.m - 1, x.d) >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return (thisYear ? now.getFullYear() : now.getFullYear() + 1) - year;
};

const presetRange = (p: Preset): [MD, MD] | null => {
  const now = new Date();
  if (p === 'today') return [mdFromDate(now), mdFromDate(now)];
  if (p === 'week') {
    const end = new Date(now); end.setDate(end.getDate() + 6);
    return [mdFromDate(now), mdFromDate(end)];
  }
  if (p === 'month') {
    const m = now.getMonth() + 1;
    return [{ m, d: 1 }, { m, d: daysIn(m) }];
  }
  return null;
};

const fillTemplate = (tpl: string, name: string, offer: string) =>
  tpl
    .replace(/\{name\}/g, name || 'there')
    .replace(/\{offer\}/g, offer)
    .replace(/\{shop\}/g, BRAND_EN)
    .replace(/\{phone\}/g, BRAND_PHONE_DISPLAY)
    .replace(/\{instagram\}/g, BRAND_INSTAGRAM);

const selectCls = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-black outline-none focus:border-[#A4164E]';
const chip = (on: boolean) =>
  `rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${on ? 'bg-black text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`;

/** Step-1 style range picker shared by Calendar and Customers tabs. */
function RangePicker({ preset, setPreset, from, setFrom, to, setTo }: {
  preset: Preset; setPreset: (p: Preset) => void;
  from: Partial<MD>; setFrom: (v: Partial<MD>) => void;
  to: Partial<MD>; setTo: (v: Partial<MD>) => void;
}) {
  const sel = (label: string, v: Partial<MD>, set: (v: Partial<MD>) => void) => (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-700">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <select className={selectCls} value={v.m ?? ''} onChange={e => { setPreset('custom'); set({ m: Number(e.target.value) || undefined, d: v.d && e.target.value && v.d > daysIn(Number(e.target.value)) ? undefined : v.d }); }}>
          <option value="">Month</option>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select className={selectCls} value={v.d ?? ''} onChange={e => { setPreset('custom'); set({ ...v, d: Number(e.target.value) || undefined }); }}>
          <option value="">Day</option>
          {Array.from({ length: v.m ? daysIn(v.m) : 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
        </select>
      </div>
    </div>
  );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {([['today', 'Today'], ['week', 'This Week'], ['month', 'This Month'], ['all', 'All']] as [Preset, string][]).map(([k, l]) => (
          <button key={k} onClick={() => { setPreset(k); setFrom({}); setTo({}); }} className={chip(preset === k)}>{l}</button>
        ))}
      </div>
      {sel('From', from, setFrom)}
      {sel('To', to, setTo)}
    </div>
  );
}

export default function Birthdays() {
  const [tab, setTab] = useState<Tab>('calendar');
  const [customers, setCustomers] = useState<BirthdayCustomer[]>([]);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  // range filter (shared)
  const [preset, setPreset] = useState<Preset>('today');
  const [from, setFrom] = useState<Partial<MD>>({});
  const [to, setTo] = useState<Partial<MD>>({});

  // calendar
  const now = new Date();
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [pickedDay, setPickedDay] = useState<MD | null>(null);

  // offers & message
  const [offers, setOffers] = useState<BirthdayOffer[]>([]);
  const [offerId, setOfferId] = useState<number | null>(null);
  const [offerEdit, setOfferEdit] = useState<{ id: number | null; label: string } | null>(null);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [savedMessage, setSavedMessage] = useState(DEFAULT_MESSAGE);
  const [notice, setNotice] = useState('');

  // customer modal
  const [modal, setModal] = useState<{ phone: string; name: string; birthDate: string; lockPhone: boolean } | null>(null);
  const [modalError, setModalError] = useState('');
  const [noneSearch, setNoneSearch] = useState('');

  const flash = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(''), 3500); };

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    const res = await fetchBirthdayCustomers();
    setCustomers(res.customers);
    setLoadError(res.error || '');
    setLoading(false);
  }, []);

  const loadOffers = useCallback(async () => {
    const list = await fetchBirthdayOffers();
    setOffers(list);
    setOfferId(cur => (cur && list.some(o => o.id === cur) ? cur : list[0]?.id ?? null));
  }, []);

  useEffect(() => {
    void loadCustomers();
    void loadOffers();
    fetchBirthdayMessage().then(m => { if (m) { setMessage(m); setSavedMessage(m); } });
  }, [loadCustomers, loadOffers]);

  const withBirthday = useMemo(() => customers.filter(c => c.birth_date), [customers]);
  const withoutBirthday = useMemo(
    () => customers.filter(c => !c.birth_date && c.orders > 0)
      .sort((a, b) => String(b.last_purchase || '').localeCompare(String(a.last_purchase || ''))),
    [customers],
  );

  /** Active range: a picked calendar day wins, then custom From/To, then a preset. */
  const activeRange = useMemo((): [MD, MD] | null => {
    if (tab === 'calendar' && pickedDay) return [pickedDay, pickedDay];
    if (preset === 'custom') {
      if (!from.m) return null;
      const f: MD = { m: from.m, d: from.d ?? 1 };
      const tm = to.m ?? from.m;
      const t: MD = { m: tm, d: to.d ?? (to.m ? daysIn(tm) : from.d ?? daysIn(tm)) };
      return [f, t];
    }
    return presetRange(preset);
  }, [tab, pickedDay, preset, from, to]);

  const matches = useMemo(() => {
    const list = activeRange ? withBirthday.filter(c => inRange(mdOf(c.birth_date!), activeRange[0], activeRange[1])) : withBirthday;
    return [...list].sort((a, b) => daysUntil(mdOf(a.birth_date!)) - daysUntil(mdOf(b.birth_date!)));
  }, [withBirthday, activeRange]);

  const birthdaysByDay = useMemo(() => {
    const set = new Set<number>();
    withBirthday.forEach(c => { const x = mdOf(c.birth_date!); if (x.m === calMonth) set.add(x.d); });
    return set;
  }, [withBirthday, calMonth]);

  const currentOffer = offers.find(o => o.id === offerId)?.label || '';

  const sendOffer = (c: BirthdayCustomer) => {
    const text = fillTemplate(message, c.name, currentOffer);
    window.open(whatsappUrl(c.phone, text), '_blank', 'noopener');
  };

  const saveOffer = async () => {
    if (!offerEdit) return;
    const res = await saveBirthdayOffer(offerEdit.label, offerEdit.id);
    if (!res.success) return flash(res.error || 'Failed to save offer');
    setOfferEdit(null);
    await loadOffers();
  };

  const removeOffer = async () => {
    if (!offerId || !window.confirm(`Delete offer "${currentOffer}"?`)) return;
    const res = await deleteBirthdayOffer(offerId);
    if (!res.success) return flash(res.error || 'Failed to delete offer');
    await loadOffers();
  };

  const saveMsg = async () => {
    const res = await saveBirthdayMessage(message);
    if (!res.success) return flash(res.error || 'Failed to save message');
    setSavedMessage(message);
    flash('Message saved');
  };

  const saveModal = async () => {
    if (!modal) return;
    if (modal.phone.replace(/\D/g, '').length < 10) return setModalError('Enter a valid 10-digit mobile number');
    if (!modal.birthDate) return setModalError('Pick the birthday');
    const res = await saveCustomerBirthday({ phone: modal.phone, name: modal.name, birthDate: modal.birthDate });
    if (!res.success) return setModalError(res.error || 'Failed to save');
    setModal(null);
    await loadCustomers();
  };

  const openModal = (c?: BirthdayCustomer) => {
    setModalError('');
    setModal(c
      ? { phone: c.phone, name: c.name, birthDate: c.birth_date?.slice(0, 10) || '', lockPhone: true }
      : { phone: '', name: '', birthDate: '', lockPhone: false });
  };

  const exportCsv = () => {
    const esc = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = [['Name', 'Mobile', 'Birthday', 'Days Until', 'Bills'],
      ...matches.map(c => [c.name, c.phone, fmtBirthday(c.birth_date!), daysUntil(mdOf(c.birth_date!)), c.orders])];
    const url = URL.createObjectURL(new Blob(['﻿' + rows.map(r => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'birthdays.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const CustomerRow = ({ c, send }: { c: BirthdayCustomer; send?: boolean }) => {
    const x = mdOf(c.birth_date!);
    const dLeft = daysUntil(x);
    const age = turningAge(c.birth_date!, x);
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-black">{c.name || 'Unnamed customer'}</p>
          <p className="text-xs font-medium text-gray-600">
            {c.phone} · 🎂 {fmtBirthday(c.birth_date!)}{age ? ` · turns ${age}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${dLeft === 0 ? 'bg-[#A4164E] text-white' : 'bg-gray-100 text-gray-700'}`}>
            {dLeft === 0 ? 'Today' : dLeft === 1 ? 'Tomorrow' : `In ${dLeft} days`}
          </span>
          <button onClick={() => openModal(c)} title="Edit birthday" className="rounded-lg border border-gray-200 p-2 text-gray-700 hover:border-[#A4164E] hover:text-[#A4164E]"><Pencil size={14} /></button>
          {send && (
            <button onClick={() => sendOffer(c)} disabled={!currentOffer}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-500 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-green-600 disabled:opacity-40">
              <MessageCircle size={14} /> Send Offer
            </button>
          )}
        </div>
      </div>
    );
  };

  const firstWeekday = new Date(now.getFullYear(), calMonth - 1, 1).getDay(); // 0 = Sun
  const todayMD = mdFromDate(now);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFF7EE] text-[#A4164E]"><Cake size={22} /></span>
          <div>
            <h2 className="text-[26px] font-black leading-tight tracking-tight text-black">Date of Birth</h2>
            <p className="text-xs font-medium text-gray-600">Customer birthdays &amp; one-tap offer sender</p>
          </div>
        </div>
        <button onClick={() => openModal()} className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-gray-800">
          <UserPlus size={16} /> Add Customer
        </button>
      </div>

      <div className="flex gap-6 border-b border-gray-200">
        {([['calendar', 'Calendar'], ['customers', 'Customers'], ['none', 'No Birthday']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`-mb-px border-b-2 pb-2 text-sm font-bold transition-colors ${tab === k ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-black'}`}>
            {l}
          </button>
        ))}
      </div>

      {loadError && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-800">{loadError}</div>}
      {notice && <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-xs font-bold text-gray-800">{notice}</div>}

      {/* CALENDAR TAB */}
      {tab === 'calendar' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className="space-y-5">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <select className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-bold" value={calMonth} onChange={e => setCalMonth(Number(e.target.value))}>
                  {SHORT.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCalMonth(m => (m === 1 ? 12 : m - 1))} className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50"><ChevronLeft size={14} /></button>
                  <button onClick={() => { setCalMonth(todayMD.m); setPickedDay(todayMD); }} className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-bold hover:bg-gray-50">Today</button>
                  <button onClick={() => setCalMonth(m => (m === 12 ? 1 : m + 1))} className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50"><ChevronRight size={14} /></button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i} className="pb-1 text-[10px] font-bold text-gray-400">{d}</span>)}
                {Array.from({ length: firstWeekday }, (_, i) => <span key={`b${i}`} />)}
                {Array.from({ length: daysIn(calMonth) }, (_, i) => {
                  const d = i + 1;
                  const picked = pickedDay?.m === calMonth && pickedDay.d === d;
                  const isToday = todayMD.m === calMonth && todayMD.d === d;
                  return (
                    <button key={d} onClick={() => setPickedDay(picked ? null : { m: calMonth, d })}
                      className={`relative rounded-lg border py-1.5 text-xs font-bold transition-colors ${
                        picked ? 'border-[#A4164E] bg-[#A4164E] text-white' : isToday ? 'border-gray-400 bg-gray-100' : 'border-gray-200 hover:bg-gray-50'
                      }`}>
                      {d}
                      {birthdaysByDay.has(d) && <span className={`absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${picked ? 'bg-white' : 'bg-red-500'}`} />}
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-[10px] font-medium text-gray-500"><span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Dot = birthday</p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-black text-black">Step 1 · Pick a date or range</h3>
              <RangePicker preset={pickedDay ? 'custom' : preset} setPreset={p => { setPickedDay(null); setPreset(p); }} from={from} setFrom={setFrom} to={to} setTo={setTo} />
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-black text-black">Step 2 · Customers with birthdays ({matches.length})</h3>
              <p className="mb-3 text-xs font-medium text-gray-500">
                {pickedDay ? `Showing ${pickedDay.d} ${MONTHS[pickedDay.m - 1]}. ` : ''}Pick a date or range on the left, then tap Send Offer on a customer.
              </p>
              <div className="max-h-[24rem] space-y-2 overflow-y-auto">
                {matches.map(c => <CustomerRow key={c.phone} c={c} send />)}
                {matches.length === 0 && <p className="py-3 text-sm text-gray-500">{loading ? 'Loading…' : 'No birthdays found for this range.'}</p>}
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100"><Gift size={18} /></span>
                  <div>
                    <h3 className="text-sm font-black text-black">Step 3 · Customise offer message</h3>
                    <p className="text-xs font-medium text-gray-500">Sent on WhatsApp when you tap &quot;Send Offer&quot;.</p>
                  </div>
                </div>
                <button onClick={() => void saveMsg()} disabled={message === savedMessage}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-black px-3 py-2 text-xs font-bold text-white disabled:bg-gray-200 disabled:text-gray-400">
                  <Save size={14} /> Save
                </button>
              </div>

              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-700">Select Offer</p>
                {offerEdit ? (
                  <div className="flex gap-2">
                    <input autoFocus className={selectCls} placeholder="e.g. 15% off on bridal blouses" value={offerEdit.label}
                      onChange={e => setOfferEdit({ ...offerEdit, label: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') void saveOffer(); }} />
                    <button onClick={() => void saveOffer()} className="rounded-xl bg-[#A4164E] px-4 text-xs font-bold text-white">Save</button>
                    <button onClick={() => setOfferEdit(null)} className="rounded-xl border border-gray-200 px-3 text-gray-600"><X size={16} /></button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <select className={selectCls} value={offerId ?? ''} onChange={e => setOfferId(Number(e.target.value) || null)}>
                      {offers.length === 0 && <option value="">No offers yet — add one</option>}
                      {offers.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                    <button onClick={() => offerId && setOfferEdit({ id: offerId, label: currentOffer })} disabled={!offerId} title="Edit offer"
                      className="rounded-xl border border-gray-200 px-3 text-gray-700 hover:border-[#A4164E] disabled:opacity-40"><Pencil size={15} /></button>
                    <button onClick={() => void removeOffer()} disabled={!offerId} title="Delete offer"
                      className="rounded-xl border border-red-100 px-3 text-red-400 hover:bg-red-50 disabled:opacity-40"><Trash2 size={15} /></button>
                  </div>
                )}
                {!offerEdit && (
                  <button onClick={() => setOfferEdit({ id: null, label: '' })}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50">
                    <Plus size={14} /> Add Offer
                  </button>
                )}
              </div>

              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-700">Customize Message</p>
                <textarea rows={7} className={`${selectCls} font-medium`} value={message} onChange={e => setMessage(e.target.value)} />
                <p className="mt-1 text-[11px] text-gray-500">
                  Use <b>{'{name}'}</b> for the customer&apos;s name and <b>{'{offer}'}</b> for the selected offer. <b>{'{shop}'}</b>, <b>{'{phone}'}</b> and <b>{'{instagram}'}</b> come from Store Settings.
                </p>
              </div>

              <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-600">Message Preview</p>
                <p className="whitespace-pre-wrap text-sm text-gray-900">{fillTemplate(message, matches[0]?.name || 'Priya', currentOffer || '(select an offer)')}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMERS TAB */}
      {tab === 'customers' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-black text-black">Filter by upcoming birthday</h3>
              <button onClick={exportCsv} disabled={matches.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 disabled:opacity-40">
                <Download size={14} /> Export CSV
              </button>
            </div>
            <RangePicker preset={preset} setPreset={setPreset} from={from} setFrom={setFrom} to={to} setTo={setTo} />
          </div>
          <div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            {matches.map(c => <CustomerRow key={c.phone} c={c} send />)}
            {matches.length === 0 && <p className="text-sm text-gray-500">{loading ? 'Loading…' : 'No birthdays found for this range.'}</p>}
          </div>
        </div>
      )}

      {/* NO BIRTHDAY TAB */}
      {tab === 'none' && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-black text-black">Customers without a birthday ({withoutBirthday.length})</h3>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={noneSearch} onChange={e => setNoneSearch(e.target.value)} placeholder="Search name or number..."
                className="w-56 rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-xs font-semibold outline-none focus:border-[#A4164E]" />
            </div>
          </div>
          <div className="max-h-[36rem] space-y-2 overflow-y-auto">
            {withoutBirthday
              .filter(c => !noneSearch.trim() || `${c.name} ${c.phone}`.toLowerCase().includes(noneSearch.trim().toLowerCase()))
              .map(c => (
                <div key={c.phone} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-bold text-black">{c.name || 'Unnamed customer'}</p>
                    <p className="text-xs font-medium text-gray-600">
                      {c.phone} · {c.orders} bill{c.orders === 1 ? '' : 's'}
                      {c.last_purchase ? ` · last ${new Date(c.last_purchase).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}
                    </p>
                  </div>
                  <button onClick={() => openModal(c)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#A4164E]/40 px-3 py-2 text-xs font-bold text-[#A4164E] hover:bg-[#FFF7EE]">
                    <Cake size={14} /> Add Birthday
                  </button>
                </div>
              ))}
            {withoutBirthday.length === 0 && (
              <p className="text-sm text-gray-500">{loading ? 'Loading…' : 'Every customer who has bought has a birthday saved.'}</p>
            )}
          </div>
        </div>
      )}

      {/* ADD / EDIT CUSTOMER MODAL */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(null)}>
          <div className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-extrabold text-black">{modal.lockPhone ? 'Customer Birthday' : 'Add Customer'}</h3>
              <button onClick={() => setModal(null)} className="rounded-full p-1 text-gray-500 hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-700">Customer Name</p>
              <input className={selectCls} value={modal.name} placeholder="Name" onChange={e => setModal({ ...modal, name: e.target.value })} />
            </div>
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-700">Mobile Number (WhatsApp)</p>
              <input className={`${selectCls} disabled:bg-gray-50`} type="tel" inputMode="numeric" maxLength={10} disabled={modal.lockPhone}
                value={modal.phone} placeholder="10-digit number"
                onChange={e => setModal({ ...modal, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} />
            </div>
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-700">Birthday</p>
              <input className={selectCls} type="date" max={new Date().toISOString().slice(0, 10)}
                value={modal.birthDate} onChange={e => setModal({ ...modal, birthDate: e.target.value })} />
            </div>
            {modalError && <p className="text-xs font-bold text-red-600">{modalError}</p>}
            <button onClick={() => void saveModal()} className="w-full rounded-2xl bg-[#A4164E] py-3 text-sm font-bold uppercase tracking-wider text-white hover:brightness-95">
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
