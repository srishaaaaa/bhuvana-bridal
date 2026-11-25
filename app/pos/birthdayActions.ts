"use server";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const MIGRATION_HINT = "Birthdays need a database update: run supabase_birthdays_migration.sql in Supabase.";

const friendly = (err: any, fallback: string) => {
  const msg = String(err?.message || "");
  if (/customer_profiles|birthday_offers|birthday_message/.test(msg)) return MIGRATION_HINT;
  return msg || fallback;
};

/** Phones are stored as their last 10 digits so "+91 98765 43210" and "9876543210" match. */
const phoneKey = (phone: string) => (phone || "").replace(/\D/g, "").slice(-10);

export type BirthdayCustomer = {
  phone: string;
  name: string;
  birth_date: string | null; // YYYY-MM-DD
  last_purchase: string | null;
  orders: number;
};

export async function getCustomerProfile(phone: string): Promise<{ name: string | null; birth_date: string | null } | null> {
  const key = phoneKey(phone);
  if (!isSupabaseConfigured || key.length !== 10) return null;
  try {
    const { data } = await supabase.from("customer_profiles").select("name, birth_date").eq("phone", key).maybeSingle();
    return data ? { name: data.name ?? null, birth_date: data.birth_date ?? null } : null;
  } catch {
    return null;
  }
}

/** Saves a customer's birthday. A blank birthday never wipes one already saved. */
export async function saveCustomerBirthday(input: { phone: string; name?: string | null; birthDate?: string | null }) {
  const key = phoneKey(input.phone);
  if (!isSupabaseConfigured) return { success: false, error: "Database not configured" };
  if (key.length !== 10) return { success: false, error: "Enter a valid 10-digit mobile number" };
  try {
    const row: Record<string, any> = { phone: key, updated_at: new Date().toISOString() };
    if (input.name && input.name.trim() && !/^(guest|walk-in customer|counter customer)$/i.test(input.name.trim())) {
      row.name = input.name.trim();
    }
    if (input.birthDate) row.birth_date = input.birthDate;
    const { error } = await supabase.from("customer_profiles").upsert(row, { onConflict: "phone" });
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: friendly(err, "Failed to save birthday") };
  }
}

export async function clearCustomerBirthday(phone: string) {
  if (!isSupabaseConfigured) return { success: false, error: "Database not configured" };
  try {
    const { error } = await supabase.from("customer_profiles").update({ birth_date: null }).eq("phone", phoneKey(phone));
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: friendly(err, "Failed to remove birthday") };
  }
}

/** Every known customer (from saved profiles and past bills), with their birthday if saved. */
export async function fetchBirthdayCustomers(): Promise<{ customers: BirthdayCustomer[]; error?: string }> {
  if (!isSupabaseConfigured) return { customers: [] };
  const map = new Map<string, BirthdayCustomer>();
  try {
    const { data: orders } = await supabase
      .from("orders")
      .select("customer_name, phone, created_at")
      .order("created_at", { ascending: false })
      .limit(20000);
    for (const o of orders || []) {
      const key = phoneKey(o.phone || "");
      if (key.length !== 10) continue;
      const existing = map.get(key);
      if (existing) {
        existing.orders += 1;
      } else {
        const name = String(o.customer_name || "").trim();
        map.set(key, {
          phone: key,
          name: /^(guest|counter customer)$/i.test(name) ? "" : name,
          birth_date: null,
          last_purchase: o.created_at || null,
          orders: 1,
        });
      }
    }

    const { data: profiles, error } = await supabase.from("customer_profiles").select("phone, name, birth_date");
    if (error) throw error;
    for (const p of profiles || []) {
      const existing = map.get(p.phone);
      if (existing) {
        existing.birth_date = p.birth_date ?? null;
        if (p.name) existing.name = p.name;
      } else {
        map.set(p.phone, { phone: p.phone, name: p.name || "", birth_date: p.birth_date ?? null, last_purchase: null, orders: 0 });
      }
    }
    return { customers: [...map.values()] };
  } catch (err: any) {
    return { customers: [...map.values()], error: friendly(err, "Failed to load customers") };
  }
}

// ── Offers & message template ────────────────────────────────────────────

export type BirthdayOffer = { id: number; label: string };

export async function fetchBirthdayOffers(): Promise<BirthdayOffer[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data } = await supabase.from("birthday_offers").select("id, label").order("created_at", { ascending: true });
    return (data || []).map((o: any) => ({ id: Number(o.id), label: String(o.label) }));
  } catch {
    return [];
  }
}

export async function saveBirthdayOffer(label: string, id?: number | null) {
  if (!isSupabaseConfigured) return { success: false, error: "Database not configured" };
  const clean = label.trim();
  if (!clean) return { success: false, error: "Offer cannot be empty" };
  try {
    const q = id
      ? supabase.from("birthday_offers").update({ label: clean }).eq("id", id)
      : supabase.from("birthday_offers").insert({ label: clean });
    const { error } = await q;
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: friendly(err, "Failed to save offer") };
  }
}

export async function deleteBirthdayOffer(id: number) {
  if (!isSupabaseConfigured) return { success: false, error: "Database not configured" };
  try {
    const { error } = await supabase.from("birthday_offers").delete().eq("id", id);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: friendly(err, "Failed to delete offer") };
  }
}

export async function fetchBirthdayMessage(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data } = await supabase.from("store_settings").select("birthday_message").eq("id", 1).maybeSingle();
    return data?.birthday_message || null;
  } catch {
    return null;
  }
}

export async function saveBirthdayMessage(message: string) {
  if (!isSupabaseConfigured) return { success: false, error: "Database not configured" };
  try {
    const { error } = await supabase.from("store_settings").update({ birthday_message: message }).eq("id", 1);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: friendly(err, "Failed to save message") };
  }
}
