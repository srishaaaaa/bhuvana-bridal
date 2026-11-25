import type { Metadata } from "next";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { DEFAULT_SHOP_PROFILE } from "@/lib/brand";
import { isValidUpiId } from "@/lib/upi";
import PayView from "./PayView";

export const dynamic = "force-dynamic";

type Search = { [key: string]: string | string[] | undefined };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";

/** Payee details always come from Store Settings, never from the link, so a link can't redirect money. */
async function loadPayee() {
  let row: any = null;
  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase
        .from("store_settings")
        .select("name, upi_id, upi_payee_name, gpay_number")
        .eq("id", 1)
        .maybeSingle();
      row = data;
    } catch {
      row = null;
    }
  }
  const shop = row?.name || DEFAULT_SHOP_PROFILE.name;
  return {
    shop,
    upiId: isValidUpiId(row?.upi_id || "") ? String(row.upi_id).trim() : "",
    payee: (row?.upi_payee_name || "").trim() || shop,
    gpayNumber: (row?.gpay_number ?? DEFAULT_SHOP_PROFILE.gpayNumber ?? "").trim(),
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const { shop } = await loadPayee();
  return { title: `Pay ${shop}`, description: `Pay your bill at ${shop} by UPI`, robots: { index: false } };
}

export default async function PayPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const amount = Math.round((parseFloat(first(sp.am)) || 0) * 100) / 100;
  const name = first(sp.n).replace(/[<>]/g, "").slice(0, 40);
  const note = first(sp.tn).replace(/[^A-Za-z0-9-]/g, "").slice(0, 20);
  const payee = await loadPayee();

  // Guard against nonsense amounts in hand-edited links.
  const validAmount = amount > 0 && amount <= 1000000 ? amount : 0;

  return <PayView {...payee} amount={validAmount} customerName={name} initialNote={note} />;
}
