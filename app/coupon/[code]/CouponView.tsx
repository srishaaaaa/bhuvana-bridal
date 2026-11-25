"use client";

import React, { useState } from "react";
import { Copy, Check, Download, Loader2, MapPin, Phone, AtSign } from "lucide-react";
import { buildCouponPdf, couponPdfFileName } from "@/lib/couponPdf";

export type CouponCardData = {
  code: string;
  percentage: number;
  minOrder: number;
  expiry: string | null; // YYYY-MM-DD
  personal: boolean;
  status: "valid" | "expired" | "inactive" | "used_up";
};

type Shop = { name: string; phone: string; address: string; instagram: string };

const fmtDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
const inr = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

const STATUS_TEXT: Record<Exclude<CouponCardData["status"], "valid">, string> = {
  expired: "This coupon has expired.",
  inactive: "This coupon is no longer active.",
  used_up: "This coupon has reached its usage limit.",
};

/** Loads the logo and shrinks it to a small JPEG so the PDF stays light. */
async function logoDataUrl(): Promise<string | null> {
  try {
    const img = new Image();
    img.src = "/logo.png";
    await img.decode();
    const size = 320;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    return canvas.toDataURL("image/jpeg", 0.9);
  } catch {
    return null;
  }
}

async function downloadPdf(shop: Shop, c: CouponCardData, customerName: string) {
  const [{ jsPDF }, logo] = await Promise.all([import("jspdf"), logoDataUrl()]);
  buildCouponPdf(jsPDF, shop, c, customerName, logo).save(couponPdfFileName(shop, c));
}

export default function CouponView({ shop, coupon, customerName }: { shop: Shop; coupon: CouponCardData | null; customerName: string }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!coupon) {
    return (
      <main className="flex min-h-[100dvh] w-full items-center justify-center bg-[#F6EEE3] p-6">
        <div className="max-w-sm rounded-3xl bg-white p-8 text-center shadow-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt={`${shop.name} logo`} className="mx-auto mb-4 h-20 w-20 rounded-2xl object-cover" />
          <h1 className="text-lg font-black text-[#5E0B2B]">Coupon not found</h1>
          <p className="mt-2 text-sm text-gray-600">Please check the link, or ask {shop.name} to send it again.</p>
        </div>
      </main>
    );
  }

  const valid = coupon.status === "valid";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const download = async () => {
    setBusy(true);
    setError("");
    try {
      await downloadPdf(shop, coupon, customerName);
    } catch {
      setError("Could not create the PDF. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const terms = coupon.personal ? "Valid only for the mobile number it was sent to." : "Cannot be combined with other offers.";

  return (
    // One screen, no scrolling: landscape ticket on desktop, compact portrait ticket on phones.
    <main className="flex min-h-[100dvh] w-full items-center justify-center bg-[radial-gradient(circle_at_top,#FBE9DA,#F3E3D0_55%,#EBD6BF)] p-3 sm:p-6">
      <div className="relative flex w-full max-w-[360px] flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-[0_25px_60px_-15px_rgba(94,11,43,0.45)] ring-1 ring-[#C9A063]/60 md:max-w-[820px] md:flex-row">
        {/* Ruby panel */}
        <div className="relative flex shrink-0 flex-col items-center justify-center bg-gradient-to-br from-[#A4164E] via-[#8E1240] to-[#5E0B2B] px-5 pb-8 pt-5 text-center md:w-[36%] md:px-6 md:py-8">
          <div className="pointer-events-none absolute inset-2.5 rounded-[1.25rem] border border-[#C9A063]/50 md:inset-3" />
          {customerName && (
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-[#E9CC8E]">For {customerName}</p>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt={`${shop.name} logo`}
            className="h-[clamp(3.5rem,11dvh,5rem)] w-[clamp(3.5rem,11dvh,5rem)] rounded-full object-cover shadow-lg ring-4 ring-[#C9A063]/70 md:h-28 md:w-28"
          />
          <h1 className="mt-2 font-serif text-lg font-bold leading-tight tracking-wide text-[#E9CC8E] md:mt-4 md:text-xl">{shop.name}</h1>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.35em] text-white/80 md:mt-2">
            {coupon.personal ? "A personal gift for you" : "Exclusive offer"}
          </p>
        </div>

        {/* Perforation: horizontal on phones, vertical on desktop */}
        <div className="relative -mt-4 h-8 shrink-0 md:mt-0 md:-ml-4 md:h-auto md:w-8">
          <span className="absolute -left-4 top-0 h-8 w-8 rounded-full bg-[#F3E3D0] md:-top-4 md:left-0" />
          <span className="absolute -right-4 top-0 h-8 w-8 rounded-full bg-[#F3E3D0] md:-bottom-4 md:left-0 md:right-auto md:top-auto" />
          <span className="absolute left-6 right-6 top-1/2 border-t-2 border-dashed border-[#C9A063]/60 md:bottom-6 md:left-1/2 md:right-auto md:top-6 md:border-l-2 md:border-t-0" />
        </div>

        {/* Offer */}
        <div className="flex min-w-0 flex-1 flex-col px-5 pb-5 text-center md:py-7 md:pl-2 md:pr-8 md:text-left">
          <p className="font-serif text-[clamp(2.75rem,9dvh,3.75rem)] font-black leading-none text-[#A4164E] md:text-6xl">
            {coupon.percentage}%<span className="ml-1 text-[0.5em]">OFF</span>
          </p>
          <p className="mt-1 text-sm font-medium text-gray-600">
            {coupon.minOrder > 0 ? `on your purchase of ₹${inr(coupon.minOrder)} and above` : "on your next purchase"}
          </p>

          <button
            type="button"
            onClick={copy}
            className="mt-3 flex w-full items-center justify-between rounded-2xl border-2 border-dashed border-[#A4164E]/60 bg-[#FDF1E6] px-4 py-2.5 transition-colors hover:bg-[#FBE7D6]"
          >
            <span className="min-w-0 text-left">
              <span className="block text-[9px] font-bold uppercase tracking-[0.25em] text-gray-500">Coupon code</span>
              <span className="block truncate font-mono text-xl font-black tracking-[0.15em] text-[#5E0B2B]">{coupon.code}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-[#A4164E] shadow-sm">
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
            </span>
          </button>

          <p className="mt-2 text-xs font-bold text-[#A4164E]">
            {coupon.expiry ? `Valid till ${fmtDate(coupon.expiry)}` : "No expiry date"}
            <span className="font-medium text-gray-500"> · Show at the billing counter. {terms}</span>
          </p>

          {!valid && (
            <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">
              {STATUS_TEXT[coupon.status as Exclude<CouponCardData["status"], "valid">]}
            </p>
          )}

          <div className="mt-3 space-y-1 border-t border-[#E7D9C4] pt-2.5 text-left text-[11px] leading-snug text-gray-600 md:mb-5">
            {shop.address && (
              <p className="flex items-start gap-1.5"><MapPin size={12} className="mt-0.5 shrink-0 text-[#A4164E]" /> {shop.address}</p>
            )}
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {shop.phone && (
                <span className="flex items-center gap-1.5"><Phone size={12} className="shrink-0 text-[#A4164E]" /> {shop.phone}</span>
              )}
              {shop.instagram && (
                <span className="flex items-center gap-1.5"><AtSign size={12} className="shrink-0 text-[#A4164E]" /> {shop.instagram}</span>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={download}
            disabled={busy || !valid}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#A4164E] to-[#5E0B2B] py-3 text-xs font-bold uppercase tracking-[0.15em] text-[#F6E3B4] shadow-lg transition-transform active:scale-[0.98] disabled:opacity-50 md:mt-auto"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {busy ? "Preparing PDF…" : "Download Coupon (PDF)"}
          </button>
          {error && <p className="mt-1.5 text-center text-xs font-bold text-red-600">{error}</p>}
        </div>
      </div>
    </main>
  );
}
