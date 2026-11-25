"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Tag, CheckCircle2, Repeat, RefreshCw, Edit2, Trash2, Plus, Search, MessageCircle, Lock, X, Info } from 'lucide-react';
import {
  fetchCoupons,
  saveCoupon,
  deleteCoupon as removeCouponAction,
  toggleCouponActive,
  recordCouponSent,
} from '@/app/pos/actions';
import { BRAND_EN, BRAND_ADDRESS, BRAND_PHONE_DISPLAY, toE164 } from '@/lib/brand';
import { isPrivateAddress, siteBaseUrl } from '@/lib/upi';

export interface CouponItem {
  id: number;
  code: string;
  percentage: number;
  is_active: boolean;
  expiry_date?: string | null;
  usage_limit?: number | null;
  usage_count?: number;
  min_order_value?: number;
  sent_only?: boolean;
  sent_phones?: string[] | null;
  sent_count?: number;
}

type Filter = 'all' | 'everyone' | 'sent_only';

const EMPTY_FORM = { code: '', percentage: '', expiry_date: '', usage_limit: '', min_order_value: '', sent_only: false };

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

/** Public coupon page (https, so WhatsApp makes it tappable); the customer can save it as a PDF there. */
const couponLink = (c: CouponItem, name?: string) => {
  const base = siteBaseUrl();
  if (!base || isPrivateAddress(base)) return '';
  const q = name && name.trim() ? `?n=${encodeURIComponent(name.trim().slice(0, 40))}` : '';
  return `${base.replace(/\/+$/, '')}/coupon/${encodeURIComponent(c.code)}${q}`;
};

const buildMessage = (c: CouponItem, name?: string) => {
  const link = couponLink(c, name);
  const lines = [
    `✨ *${BRAND_EN}* ✨`,
    '',
    name && name.trim() ? `Dear ${name.trim()},` : 'Dear Customer,',
    c.sent_only
      ? 'Here is an exclusive coupon reserved just for you 💝'
      : 'Here is an exclusive coupon for you 💝',
    '',
    `🎁 *${c.percentage}% OFF*${c.min_order_value ? ` on purchases above ${inr(c.min_order_value)}` : ''}`,
    `🏷️ Code: *${c.code}*`,
  ];
  if (c.expiry_date) lines.push(`⏳ Valid till ${fmtDate(c.expiry_date)}`);
  if (link) lines.push('', '👉 Open & download your coupon:', link);
  lines.push('', 'Show this coupon at our billing counter to redeem.');
  if (BRAND_ADDRESS) lines.push('', `📍 ${BRAND_ADDRESS}`);
  if (BRAND_PHONE_DISPLAY) lines.push(`📞 ${BRAND_PHONE_DISPLAY}`);
  return lines.join('\n');
};

const inputCls =
  'w-full rounded-xl border border-transparent bg-[#FFF7EE] px-4 py-3 text-sm font-medium text-black outline-none transition-colors focus:border-[#A4164E] focus:bg-white focus:ring-2 focus:ring-[#A4164E]/20 placeholder:text-gray-400';
const labelCls = 'block text-gray-800 font-bold uppercase tracking-wider text-xs mb-1.5';

export default function Coupons() {
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCouponId, setEditingCouponId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [sendTarget, setSendTarget] = useState<CouponItem | null>(null);
  const [sendPhone, setSendPhone] = useState('');
  const [sendName, setSendName] = useState('');
  const [sendError, setSendError] = useState('');

  const loadCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCoupons();
      setCoupons(data as CouponItem[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCoupons();
  }, [loadCoupons]);

  const counts = useMemo(() => ({
    all: coupons.length,
    everyone: coupons.filter(c => !c.sent_only).length,
    sent_only: coupons.filter(c => c.sent_only).length,
  }), [coupons]);

  const visible = useMemo(() => {
    const q = search.trim().toUpperCase();
    return coupons.filter(c => {
      if (filter === 'everyone' && c.sent_only) return false;
      if (filter === 'sent_only' && !c.sent_only) return false;
      return !q || c.code.toUpperCase().includes(q);
    });
  }, [coupons, filter, search]);

  const generateCouponCode = () => {
    const prefixes = ['BRIDAL', 'BHUVANA', 'SAVE', 'FESTIVE', 'WELCOME'];
    const p = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(10 + Math.random() * 90);
    setForm(f => ({ ...f, code: `${p}${num}` }));
    setError('');
  };

  const resetForm = () => {
    setEditingCouponId(null);
    setForm(EMPTY_FORM);
    setError('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const pct = Number(form.percentage);
    if (!form.code.trim()) return setError('Coupon code is required');
    if (!pct || pct < 1 || pct > 100) return setError('Discount must be between 1 and 100%');

    const res = await saveCoupon({
      id: editingCouponId,
      code: form.code,
      percentage: pct,
      expiry_date: form.expiry_date || null,
      usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
      min_order_value: form.min_order_value ? Number(form.min_order_value) : 0,
      sent_only: form.sent_only,
    });
    if (!res.success) return setError(res.error || 'Failed to save coupon');

    const wasEditing = editingCouponId !== null;
    resetForm();
    setSuccess(wasEditing ? 'Coupon updated!' : 'Coupon created!');
    await loadCoupons();
    setTimeout(() => setSuccess(''), 4000);
  };

  const startEdit = (c: CouponItem) => {
    setEditingCouponId(c.id);
    setForm({
      code: c.code,
      percentage: String(c.percentage),
      expiry_date: c.expiry_date ? c.expiry_date.slice(0, 10) : '',
      usage_limit: c.usage_limit ? String(c.usage_limit) : '',
      min_order_value: c.min_order_value ? String(c.min_order_value) : '',
      sent_only: !!c.sent_only,
    });
    setError('');
    setSuccess('');
  };

  const handleDelete = async (c: CouponItem) => {
    if (!window.confirm(`Delete coupon "${c.code}"? This cannot be undone.`)) return;
    await removeCouponAction(c.id);
    if (editingCouponId === c.id) resetForm();
    await loadCoupons();
  };

  const handleToggle = async (c: CouponItem) => {
    await toggleCouponActive(c.id, c.is_active);
    await loadCoupons();
  };

  /** Opens WhatsApp's contact picker so the coupon can go to any chats, groups or broadcast lists. */
  const shareEveryone = async (c: CouponItem) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(buildMessage(c))}`, '_blank', 'noopener');
    await recordCouponSent(c.id, null);
    await loadCoupons();
  };

  const openSend = (c: CouponItem) => {
    setSendTarget(c);
    setSendPhone('');
    setSendName('');
    setSendError('');
  };

  const confirmSend = async () => {
    if (!sendTarget) return;
    const digits = sendPhone.replace(/\D/g, '');
    if (digits.length < 10) return setSendError('Enter a valid 10-digit mobile number');
    const res = await recordCouponSent(sendTarget.id, digits);
    if (!res.success) return setSendError(res.error || 'Could not record this send');
    window.open(`https://wa.me/${toE164(digits)}?text=${encodeURIComponent(buildMessage(sendTarget, sendName))}`, '_blank', 'noopener');
    setSendTarget(null);
    await loadCoupons();
  };

  const totalUsed = coupons.reduce((acc, c) => acc + (c.usage_count || 0), 0);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2.5 text-[26px] font-black text-[#111111] tracking-tight leading-tight">
            <span className="w-1.5 h-7 rounded-full bg-[#A4164E] flex-shrink-0 inline-block" />
            <span>Coupon Management</span>
          </h2>
          <p className="max-w-2xl text-sm font-medium text-gray-600 leading-snug">
            Create discount codes and send them to customers on WhatsApp. Applies to product subtotal only.
          </p>
        </div>
        <button
          onClick={() => void loadCoupons()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs sm:text-sm font-bold text-black shadow-sm transition-colors hover:bg-gray-50 active:scale-95 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Total Coupons', value: coupons.length, sub: 'Configured promotional codes', Icon: Tag, color: 'text-[#111111]' },
          { label: 'Active Coupons', value: coupons.filter(c => c.is_active).length, sub: 'Live & ready at POS checkout', Icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Total Redemptions', value: totalUsed, sub: 'Times used on bills', Icon: Repeat, color: 'text-[#111111]' },
        ].map(c => (
          <div key={c.label} className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex items-start justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-800">{c.label}</p>
              <c.Icon size={18} className="text-[#A4164E]" />
            </div>
            <p className={`mt-2 text-2xl font-black ${c.color}`}>{c.value}</p>
            <p className="text-xs font-medium text-gray-500">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-2.5 text-xs font-semibold text-gray-800">
        <Info size={15} className="shrink-0 text-gray-500" />
        Coupon discount applies to product subtotal only — delivery charges are excluded.
      </div>

      {/* FORM & LIST */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* CREATE / EDIT FORM */}
        <form onSubmit={handleSave} className="h-fit space-y-5 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-lg font-extrabold text-black">
              {editingCouponId !== null ? <Edit2 size={18} /> : <Plus size={20} />}
              {editingCouponId !== null ? 'Edit Coupon' : 'New Coupon'}
            </h3>
            {editingCouponId !== null && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
          </div>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-bold text-red-700">{error}</div>}
          {success && <div className="rounded-xl border border-green-200 bg-green-50 px-3.5 py-2.5 text-xs font-bold text-green-700">{success}</div>}

          <div>
            <label className={labelCls}>Coupon Code *</label>
            <div className="relative">
              <input
                className={`${inputCls} pr-28 uppercase tracking-[0.12em] font-bold placeholder:normal-case placeholder:tracking-normal placeholder:font-medium`}
                placeholder="E.G. SUMMER20"
                value={form.code}
                disabled={editingCouponId !== null}
                onChange={e => {
                  setForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/\s/g, '') }));
                  setError('');
                }}
              />
              {editingCouponId === null && (
                <button
                  type="button"
                  onClick={generateCouponCode}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-[#A4164E] px-4 py-2 text-xs font-bold text-white shadow-sm hover:brightness-95 active:scale-95"
                >
                  Generate
                </button>
              )}
            </div>
            {editingCouponId !== null && <p className="mt-1 text-xs font-medium text-gray-500">Code cannot be changed when editing</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Discount % *</label>
              <input type="number" min="1" max="100" className={inputCls} placeholder="e.g. 15"
                value={form.percentage} onChange={e => setForm(f => ({ ...f, percentage: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Min Order (₹)</label>
              <input type="number" min="0" className={inputCls} placeholder="e.g. 1000"
                value={form.min_order_value} onChange={e => setForm(f => ({ ...f, min_order_value: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Expiry Date</label>
              <input type="date" className={inputCls}
                value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Usage Limit</label>
              <input type="number" min="1" className={inputCls} placeholder="e.g. 50"
                value={form.usage_limit} onChange={e => setForm(f => ({ ...f, usage_limit: e.target.value }))} />
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={form.sent_only}
            onClick={() => setForm(f => ({ ...f, sent_only: !f.sent_only }))}
            className="flex w-full items-center justify-between gap-4 rounded-2xl bg-[#FFF7EE] px-4 py-3.5 text-left"
          >
            <span>
              <span className="block text-sm font-bold text-black">Only for customers it&apos;s sent to</span>
              <span className="block text-xs font-medium text-gray-600">Works only for the mobile numbers you send it to from this page.</span>
            </span>
            <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${form.sent_only ? 'bg-[#A4164E]' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${form.sent_only ? 'left-[22px]' : 'left-0.5'}`} />
            </span>
          </button>

          <button type="submit" className="w-full rounded-2xl bg-[#A4164E] py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-md hover:brightness-95 active:scale-[0.99]">
            {editingCouponId !== null ? 'Update Coupon' : 'Create Coupon'}
          </button>
        </form>

        {/* COUPON LIST */}
        <div className="h-fit rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-extrabold text-black">
            All Coupons
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-black px-2 text-xs font-bold text-white">{coupons.length}</span>
          </h3>

          <div className="mb-3 flex flex-wrap gap-2">
            {([
              ['all', 'All'],
              ['everyone', 'Everyone'],
              ['sent_only', 'Sent only'],
            ] as [Filter, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors ${
                  filter === key ? 'border-black bg-black text-white' : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
                }`}
              >
                {label} <span className={filter === key ? 'text-white/70' : 'text-gray-500'}>{counts[key]}</span>
              </button>
            ))}
          </div>

          <div className="relative mb-4">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className={`${inputCls} pl-10`} placeholder="Search coupons by code..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div className="max-h-[36rem] space-y-3 overflow-y-auto pr-1">
            {visible.map(c => {
              const isExpired = c.expiry_date ? new Date(`${c.expiry_date.slice(0, 10)}T23:59:59`) < new Date() : false;
              const isExhausted = !!c.usage_limit && (c.usage_count || 0) >= c.usage_limit;
              const isEditing = editingCouponId === c.id;
              const sentNumbers = c.sent_phones?.length || 0;

              return (
                <div
                  key={c.id}
                  className={`rounded-2xl border p-4 shadow-sm transition-all ${
                    isEditing ? 'border-[#A4164E] bg-[#FFF7EE] ring-1 ring-[#A4164E]/20' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-base font-bold tracking-[0.12em] text-black">{c.code}</p>
                    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      c.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-100 text-gray-600'
                    }`}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {isExpired && <span className="rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700">Expired</span>}
                    {!isExpired && isExhausted && <span className="rounded-md bg-orange-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-700">Limit reached</span>}
                  </div>

                  <p className="mt-1.5 text-sm font-extrabold text-[#A4164E]">
                    {c.percentage}% OFF
                    {c.min_order_value ? <span className="font-semibold text-gray-700"> · min {inr(c.min_order_value)}</span> : null}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-gray-600">
                    Used {c.usage_count || 0} times{c.usage_limit ? ` of ${c.usage_limit}` : ''}
                    {' • '}{c.expiry_date ? `expires ${fmtDate(c.expiry_date)}` : 'no expiry'}
                    {c.sent_count ? ` • sent ${c.sent_count}×` : ''}
                    {c.sent_only ? ` • ${sentNumbers} number${sentNumbers === 1 ? '' : 's'} allowed` : ''}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {c.sent_only ? (
                      <span
                        title="Only works for numbers you send it to with the Send button"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-amber-700"
                      >
                        <Lock size={14} /> Sent only
                      </span>
                    ) : (
                      <button
                        onClick={() => void shareEveryone(c)}
                        title="Share on WhatsApp — pick any contacts, groups or broadcast lists"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-green-500 bg-white px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-green-600 hover:bg-green-50 active:scale-95"
                      >
                        <MessageCircle size={14} /> Everyone
                      </button>
                    )}
                    <button
                      onClick={() => openSend(c)}
                      title="Send to a customer's WhatsApp number"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-green-500 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-green-600 active:scale-95"
                    >
                      <MessageCircle size={14} /> Send
                    </button>
                    <button
                      onClick={() => void handleToggle(c)}
                      title={c.is_active ? 'Click to turn off' : 'Click to turn on'}
                      className={`rounded-xl px-3.5 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                        c.is_active ? 'bg-black text-white hover:bg-gray-800' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {c.is_active ? 'Active' : 'Off'}
                    </button>
                    <button onClick={() => startEdit(c)} title="Edit coupon"
                      className="rounded-xl border border-gray-200 bg-white p-2 text-gray-700 hover:border-[#A4164E] hover:text-[#A4164E]">
                      <Edit2 size={15} />
                    </button>
                    <button onClick={() => void handleDelete(c)} title="Delete coupon"
                      className="rounded-xl border border-gray-200 bg-white p-2 text-gray-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}

            {visible.length === 0 && !loading && (
              <div className="py-12 text-center text-sm font-medium text-gray-500">
                {coupons.length === 0 ? 'No coupons yet. Create your first coupon using the form.' : 'No coupons match this filter.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SEND TO NUMBER DIALOG */}
      {sendTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSendTarget(null)}>
          <div className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-black">Send {sendTarget.code}</h3>
                <p className="text-xs font-medium text-gray-600">Opens WhatsApp with the coupon message ready to send.</p>
              </div>
              <button onClick={() => setSendTarget(null)} className="rounded-full p-1 text-gray-500 hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div>
              <label className={labelCls}>Customer name (optional)</label>
              <input
                className={inputCls}
                placeholder="e.g. Priya"
                value={sendName}
                onChange={e => setSendName(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Customer mobile number</label>
              <input
                autoFocus
                type="tel"
                inputMode="numeric"
                className={inputCls}
                placeholder="10-digit mobile number"
                value={sendPhone}
                onChange={e => { setSendPhone(e.target.value); setSendError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') void confirmSend(); }}
              />
              {sendError && <p className="mt-1.5 text-xs font-bold text-red-600">{sendError}</p>}
            </div>
            <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl bg-gray-50 p-3 font-sans text-xs text-gray-700">{buildMessage(sendTarget, sendName)}</pre>
            <button onClick={() => void confirmSend()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-green-500 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-green-600">
              <MessageCircle size={16} /> Send on WhatsApp
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
