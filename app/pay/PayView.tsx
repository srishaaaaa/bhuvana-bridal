"use client";

import React, { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { buildUpiAppLinks, buildUpiLink, newPaymentNote } from "@/lib/upi";

const QR_LIFETIME_SECONDS = 120;

const money = (n: number) => {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  const d = Number.isInteger(v) ? 0 : 2;
  return `₹${v.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: 2 })}`;
};

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Older browsers: fall back to a hidden textarea
      const t = document.createElement("textarea");
      t.value = value;
      document.body.appendChild(t);
      t.select();
      try { document.execCommand("copy"); } catch { /* ignore */ }
      t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-full border border-gray-300 bg-white px-2.5 py-0.5 text-[11px] font-bold text-gray-800 hover:bg-gray-50"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function PayView({
  shop,
  upiId,
  payee,
  gpayNumber,
  amount,
  customerName,
  initialNote,
}: {
  shop: string;
  upiId: string;
  payee: string;
  gpayNumber: string;
  amount: number;
  customerName: string;
  initialNote: string;
}) {
  const [note, setNote] = useState(initialNote || newPaymentNote());
  const [secondsLeft, setSecondsLeft] = useState(QR_LIFETIME_SECONDS);
  const [qr, setQr] = useState("");

  useEffect(() => {
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setNote(newPaymentNote());
          return QR_LIFETIME_SECONDS;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const canPay = Boolean(upiId) && amount > 0;
  const params = useMemo(() => ({ upiId, payee, amount, note }), [upiId, payee, amount, note]);
  const apps = useMemo(() => (canPay ? buildUpiAppLinks(params) : null), [canPay, params]);

  useEffect(() => {
    if (!canPay) return;
    let cancelled = false;
    QRCode.toDataURL(buildUpiLink(params), { margin: 1, width: 440, errorCorrectionLevel: "M" })
      .then((url) => { if (!cancelled) setQr(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [canPay, params]);

  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <main className="min-h-screen bg-[#F3EEE2] px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-xl">
        {/* Header */}
        <div className="bg-[#2B1A20] px-6 py-6 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#D6B36A]">{shop}</p>
          <p className="mt-1 text-sm text-white/85">
            {customerName ? `Hi ${customerName}, your bill` : "Your bill"}
          </p>
          <p className="mt-1 text-4xl font-black tracking-tight text-white">{amount > 0 ? money(amount) : "—"}</p>
        </div>

        <div className="space-y-4 px-5 py-5">
          {!canPay ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-sm font-semibold text-amber-900">
              {amount > 0
                ? `UPI payments are not set up yet. Please pay at the counter${gpayNumber ? ` or on GPay to ${gpayNumber}` : ""}.`
                : "This payment link is missing the amount. Please ask the shop to send it again."}
            </p>
          ) : (
            <>
              <p className="text-center text-sm font-semibold text-gray-800">
                Google Pay, PhonePe and Paytm open with the payee, amount and note filled in.
              </p>

              <div className="grid grid-cols-3 gap-2">
                <a href={apps!.gpay} className="flex items-center justify-center rounded-xl bg-[#1A73E8] py-3 text-sm font-bold text-white shadow-sm active:scale-95">
                  Google Pay
                </a>
                <a href={apps!.phonepe} className="flex items-center justify-center rounded-xl bg-[#5F259F] py-3 text-sm font-bold text-white shadow-sm active:scale-95">
                  PhonePe
                </a>
                <a href={apps!.paytm} className="flex items-center justify-center rounded-xl bg-[#00BAF2] py-3 text-sm font-bold text-white shadow-sm active:scale-95">
                  Paytm
                </a>
              </div>

              <div className="flex justify-center">
                <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
                  {qr ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qr} alt={`UPI QR code to pay ${money(amount)} to ${payee}`} className="h-44 w-44" />
                  ) : (
                    <div className="h-44 w-44" />
                  )}
                </div>
              </div>

              <p className="text-center text-xs text-gray-600">
                Tap your app: it opens with the amount ready. If it can&apos;t, scan the QR or enter the UPI ID in the app.
                New QR in <b className="text-black">{mm}:{ss}</b>.
              </p>

              <a href={apps!.any} className="block text-center text-xs font-bold text-[#A4164E] underline">
                Open in another UPI app
              </a>
            </>
          )}

          {/* Details */}
          <div className="space-y-2.5 rounded-2xl bg-[#F6F3EC] p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-600">Pay to</span>
              <span className="text-right font-bold text-black">{payee}</span>
            </div>
            {upiId && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-600">UPI ID</span>
                <span className="flex items-center gap-2 font-bold text-black">
                  <span className="break-all text-right">{upiId}</span>
                  <CopyButton value={upiId} />
                </span>
              </div>
            )}
            {gpayNumber && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-600">GPay number</span>
                <span className="flex items-center gap-2 font-bold text-black">
                  {gpayNumber}
                  <CopyButton value={gpayNumber.replace(/\s/g, "")} />
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-600">Amount</span>
              <span className="font-bold text-black">{amount > 0 ? money(amount) : "—"}</span>
            </div>
            {canPay && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-600">Note</span>
                <span className="font-mono text-xs font-bold text-black">{note}</span>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-gray-500">After paying, show the confirmation on your phone at the counter.</p>
        </div>
      </div>
    </main>
  );
}
