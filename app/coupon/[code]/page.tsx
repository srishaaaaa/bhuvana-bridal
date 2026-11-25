import type { Metadata } from "next";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { DEFAULT_SHOP_PROFILE } from "@/lib/brand";
import CouponView, { type CouponCardData } from "./CouponView";

export const dynamic = "force-dynamic";

type Search = { [key: string]: string | string[] | undefined };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";

async function loadShop() {
  let row: any = null;
  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase
        .from("store_settings")
        .select("name, phone, shop_contact, address, instagram_id")
        .eq("id", 1)
        .maybeSingle();
      row = data;
    } catch {
      row = null;
    }
  }
  return {
    name: row?.name || DEFAULT_SHOP_PROFILE.name,
    phone: row?.shop_contact || row?.phone || DEFAULT_SHOP_PROFILE.shopContact,
    address: row?.address || DEFAULT_SHOP_PROFILE.address,
    instagram: String(row?.instagram_id || DEFAULT_SHOP_PROFILE.instagramId).replace(/^@+/, ""),
  };
}

async function loadCoupon(code: string): Promise<CouponCardData | null> {
  const clean = code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  if (!clean || !isSupabaseConfigured) return null;
  try {
    const { data } = await supabase
      .from("coupons")
      .select("code, percentage, is_active, expiry_date, usage_limit, usage_count, min_order_value, sent_only")
      .ilike("code", clean)
      .limit(1);
    const c = data?.[0];
    if (!c) return null;
    const expired = c.expiry_date ? new Date(`${String(c.expiry_date).slice(0, 10)}T23:59:59`) < new Date() : false;
    const exhausted = !!c.usage_limit && Number(c.usage_count || 0) >= Number(c.usage_limit);
    return {
      code: String(c.code).toUpperCase(),
      percentage: Number(c.percentage) || 0,
      minOrder: Number(c.min_order_value) || 0,
      expiry: c.expiry_date ? String(c.expiry_date).slice(0, 10) : null,
      personal: !!c.sent_only,
      status: !c.is_active ? "inactive" : expired ? "expired" : exhausted ? "used_up" : "valid",
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const [shop, coupon] = await Promise.all([loadShop(), loadCoupon(code)]);
  const title = coupon ? `${coupon.percentage}% OFF · ${shop.name}` : `Coupon · ${shop.name}`;
  return {
    title,
    description: coupon ? `Your exclusive coupon ${coupon.code} from ${shop.name}` : undefined,
    robots: { index: false },
    openGraph: { title, images: ["/logo.png"] },
  };
}

export default async function CouponPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Search>;
}) {
  const [{ code }, sp] = await Promise.all([params, searchParams]);
  const [shop, coupon] = await Promise.all([loadShop(), loadCoupon(code)]);
  const customerName = first(sp.n).replace(/[<>]/g, "").slice(0, 40);
  return <CouponView shop={shop} coupon={coupon} customerName={customerName} />;
}
