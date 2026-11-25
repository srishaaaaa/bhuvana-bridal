"use client";

import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { MessageCircle, QrCode, Settings } from 'lucide-react';
import { BRAND_EN, BRAND_GPAY_NUMBER, BRAND_UPI_ID, BRAND_UPI_MESSAGE, BRAND_UPI_PAYEE, toE164 } from '@/lib/brand';
import {
  UPI_VIA_OPTIONS,
  buildPayPageLink,
  buildUpiLink,
  fillUpiMessage,
  isPrivateAddress,
  isValidUpiId,
  newPaymentNote,
  siteBaseUrl,
  type UpiVia,
} from '@/lib/upi';

const QR_LIFETIME_SECONDS = 120;

const money = (n: number) => {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  const d = Number.isInteger(v) ? 0 : 2;
  return `₹${v.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: 2 })}`;
};

/**
 * UPI collection block shown in billing when the payment mode is UPI:
 * where the money came from, a scan-to-pay QR for the exact amount, and a WhatsApp payment link.
 */
export default function UpiPaymentPanel({
  amount,
  customerName,
  customerPhone,
  upiVia,
  onUpiViaChange,
  onOpenSettings,
}: {
  amount: number;
  customerName: string;
  customerPhone: string;
  upiVia: UpiVia;
  onUpiViaChange: (v: UpiVia) => void;
  onOpenSettings?: () => void;
}) {
  const upiId = BRAND_UPI_ID;
  const hasUpi = isValidUpiId(upiId);
  const [note, setNote] = useState(newPaymentNote);
  const [secondsLeft, setSecondsLeft] = useState(QR_LIFETIME_SECONDS);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [sendError, setSendError] = useState('');
  const [siteBase, setSiteBase] = useState('');
  useEffect(() => setSiteBase(siteBaseUrl()), []);
  const linkUnreachable = !siteBase || isPrivateAddress(siteBase);

  // Fresh QR (new reference note) every 2 minutes, and whenever the amount changes.
  useEffect(() => {
    setNote(newPaymentNote());
    setSecondsLeft(QR_LIFETIME_SECONDS);
  }, [amount]);

  useEffect(() => {
    const t = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          setNote(newPaymentNote());
          return QR_LIFETIME_SECONDS;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const link = useMemo(
    () => (hasUpi && amount > 0 ? buildUpiLink({ upiId, payee: BRAND_UPI_PAYEE, amount, note }) : ''),
    [hasUpi, upiId, amount, note],
  );

  useEffect(() => {
    if (!link) { setQrDataUrl(''); return; }
    let cancelled = false;
    QRCode.toDataURL(link, { margin: 1, width: 360, errorCorrectionLevel: 'M' })
      .then(url => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { if (!cancelled) setQrDataUrl(''); });
    return () => { cancelled = true; };
  }, [link]);

  const sendOnWhatsApp = () => {
    const digits = customerPhone.replace(/\D/g, '');
    if (digits.length < 10) {
      setSendError('Enter the customer’s 10-digit mobile number in Customer Details first.');
      return;
    }
    if (!(amount > 0)) {
      setSendError('Add items to the bill first.');
      return;
    }
    if (!hasUpi && !BRAND_GPAY_NUMBER) {
      setSendError('Add your UPI ID or GPay number in Store Settings first.');
      return;
    }
    setSendError('');
    // The customer gets an https payment page (tappable in WhatsApp) with app buttons and the QR.
    const payPage = hasUpi && !linkUnreachable ? buildPayPageLink(siteBase, { amount, name: customerName, note }) : '';
    const text = fillUpiMessage(BRAND_UPI_MESSAGE, {
      name: customerName,
      amount,
      shop: BRAND_EN,
      link: payPage,
      upiId: hasUpi ? upiId : '',
      gpayNumber: BRAND_GPAY_NUMBER,
      bill: note,
    });
    window.open(`https://wa.me/${toE164(digits)}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    onUpiViaChange('WhatsApp payment link');
  };

  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="mt-2 space-y-3 rounded-xl border border-black/10 bg-[#FFF7EE]/60 p-4">
      <p className="text-xs font-medium text-gray-600">Collect {money(amount)} by UPI, then complete the bill.</p>

      <div>
        <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-black">UPI payment came through</label>
        <select
          value={upiVia}
          onChange={e => onUpiViaChange(e.target.value as UpiVia)}
          className="w-full cursor-pointer rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm font-semibold text-black outline-none focus:border-[#A4164E]"
        >
          {UPI_VIA_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <p className="mt-1 text-[10px] font-medium leading-snug text-gray-500">
          Printed on the invoice and kept in reports, so payments from a WhatsApp link, the counter QR and a guest&apos;s phone can be told apart.
        </p>
      </div>

      {hasUpi ? (
        <div className="flex flex-col items-center gap-4 rounded-xl bg-[#F3EEE6] p-4 sm:flex-row sm:items-start">
          <div className="shrink-0 rounded-xl border border-black/10 bg-white p-2.5 shadow-sm">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt={`UPI QR to pay ${money(amount)}`} className="h-36 w-36" />
            ) : (
              <div className="flex h-36 w-36 items-center justify-center text-center text-[10px] font-bold text-gray-400">
                {amount > 0 ? 'Making QR…' : 'Add items to show the QR'}
              </div>
            )}
          </div>
          <div className="min-w-0 space-y-1.5 text-xs text-gray-700">
            <p className="text-sm font-black text-black">Scan to pay {money(amount)}</p>
            <p>Ask the customer to scan this with any UPI app.</p>
            <p>
              New QR in <b className="text-black">{mm}:{ss}</b> · note <span className="font-mono text-[11px]">{note}</span>
            </p>
            <p className="break-all">Pays to <b className="text-black">{upiId}</b></p>
            {BRAND_GPAY_NUMBER && (
              <p>Or the customer can pay to the GPay number <b className="text-black">{BRAND_GPAY_NUMBER}</b></p>
            )}
            <p className="text-[11px] text-gray-500">Check your UPI app for the payment, then complete the bill.</p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
          <QrCode size={16} className="mt-0.5 shrink-0" />
          <div>
            <p>Add your shop&apos;s UPI ID in Store Settings to show a scan-to-pay QR here.</p>
            {BRAND_GPAY_NUMBER && <p className="mt-1">Meanwhile the customer can pay to the GPay number <b>{BRAND_GPAY_NUMBER}</b>.</p>}
            {onOpenSettings && (
              <button type="button" onClick={onOpenSettings} className="mt-1.5 inline-flex items-center gap-1 font-bold text-[#A4164E] hover:underline">
                <Settings size={12} /> Open Store Settings
              </button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2 rounded-xl border border-dashed border-black/20 p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-700">Ask the customer to pay by UPI</p>
        <button
          type="button"
          onClick={sendOnWhatsApp}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-green-500 bg-green-50 py-2.5 text-xs font-bold text-green-700 transition-colors hover:bg-green-100"
        >
          <MessageCircle size={15} /> Send payment link on WhatsApp
        </button>
        {sendError && <p className="text-[11px] font-bold text-red-600">{sendError}</p>}
        {hasUpi && linkUnreachable && (
          <p className="text-[10px] font-semibold leading-snug text-amber-700">
            This app is open on a local address, so the message will have the UPI ID and GPay number but no tap-to-pay
            link. Open the app from its live website (or set NEXT_PUBLIC_SITE_URL) to include the payment page link.
          </p>
        )}
      </div>
    </div>
  );
}
