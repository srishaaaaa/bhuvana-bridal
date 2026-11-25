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
      <main className="flex min-h-screen items-center justify-center bg-[#F6EEE3] p-6">
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

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#FBE9DA,#F3E3D0_55%,#EBD6BF)] px-4 py-8 sm:py-14">
      <div className="mx-auto w-full max-w-md">
        <p className="mb-4 text-center text-[11px] font-bold uppercase tracking-[0.3em] text-[#8A6A3A]">
          {customerName ? `For ${customerName}` : "You've received a gift"}
        </p>

        {/* Ticket */}
        <div className="relative overflow-hidden rounded-[2rem] bg-white shadow-[0_25px_60px_-15px_rgba(94,11,43,0.45)] ring-1 ring-[#C9A063]/60">
          {/* Header band */}
          <div className="relative bg-gradient-to-br from-[#A4164E] via-[#8E1240] to-[#5E0B2B] px-6 pb-14 pt-7 text-center">
            <div className="pointer-events-none absolute inset-3 rounded-[1.4rem] border border-[#C9A063]/50" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt={`${shop.name} logo`}
              className="mx-auto h-24 w-24 rounded-full object-cover ring-4 ring-[#C9A063]/70 shadow-lg"
            />
            <h1 className="mt-3 font-serif text-xl font-bold tracking-wide text-[#E9CC8E]">{shop.name}</h1>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.35em] text-white/80">
              {coupon.personal ? "A personal gift for you" : "Exclusive offer"}
            </p>
          </div>

          {/* Perforation */}
          <div className="relative -mt-5 h-10">
            <span className="absolute -left-5 top-0 h-10 w-10 rounded-full bg-[#F3E3D0]" />
            <span className="absolute -right-5 top-0 h-10 w-10 rounded-full bg-[#F3E3D0]" />
            <span className="absolute left-7 right-7 top-1/2 border-t-2 border-dashed border-[#C9A063]/60" />
          </div>

          <div className="px-7 pb-7 text-center">
            <p className="font-serif text-6xl font-black leading-none text-[#A4164E]">
              {coupon.percentage}%<span className="ml-1 text-3xl">OFF</span>
            </p>
            <p className="mt-2 text-sm font-medium text-gray-600">
              {coupon.minOrder > 0 ? `on your purchase of ₹${inr(coupon.minOrder)} and above` : "on your next purchase"}
            </p>

            <button
              type="button"
              onClick={copy}
              className="mt-5 flex w-full items-center justify-between rounded-2xl border-2 border-dashed border-[#A4164E]/60 bg-[#FDF1E6] px-5 py-3.5 transition-colors hover:bg-[#FBE7D6]"
            >
              <span className="text-left">
                <span className="block text-[9px] font-bold uppercase tracking-[0.25em] text-gray-500">Coupon code</span>
                <span className="font-mono text-2xl font-black tracking-[0.18em] text-[#5E0B2B]">{coupon.code}</span>
              </span>
              <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-[#A4164E] shadow-sm">
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
              </span>
            </button>

            <p className="mt-3 text-xs font-bold text-[#A4164E]">
              {coupon.expiry ? `Valid till ${fmtDate(coupon.expiry)}` : "No expiry date"}
            </p>

            {!valid && (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                {STATUS_TEXT[coupon.status as Exclude<CouponCardData["status"], "valid">]}
              </p>
            )}

            <ul className="mt-4 space-y-1 text-left text-[11px] text-gray-500">
              <li>• Show this coupon at the billing counter.</li>
              <li>• {coupon.personal ? "Valid only for the mobile number it was sent to." : "Cannot be combined with other offers."}</li>
            </ul>

            <div className="mt-5 space-y-1.5 border-t border-[#E7D9C4] pt-4 text-left text-[11px] text-gray-600">
              {shop.address && (
                <p className="flex items-start gap-2"><MapPin size={13} className="mt-0.5 shrink-0 text-[#A4164E]" /> {shop.address}</p>
              )}
              {shop.phone && (
                <p className="flex items-center gap-2"><Phone size={13} className="shrink-0 text-[#A4164E]" /> {shop.phone}</p>
              )}
              {shop.instagram && (
                <p className="flex items-center gap-2"><AtSign size={13} className="shrink-0 text-[#A4164E]" /> {shop.instagram}</p>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={download}
          disabled={busy || !valid}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#A4164E] to-[#5E0B2B] py-4 text-sm font-bold uppercase tracking-[0.15em] text-[#F6E3B4] shadow-lg transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />}
          {busy ? "Preparing PDF…" : "Download Coupon (PDF)"}
        </button>
        {error && <p className="mt-2 text-center text-xs font-bold text-red-600">{error}</p>}
      </div>
    </main>
  );
}
