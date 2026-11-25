"use server";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const norm = (code: string | null | undefined) => (code ?? "").trim().toUpperCase();

export type ScannedProduct = {
  product_id: string;
  product_name: string;
  description: string | null;
  price: number;
  stock: number;
  barcode: string;
  category: string | null;
};

/** Finds the active product for a scanned code (barcode first, then SKU). */
export async function lookupBarcode(code: string): Promise<ScannedProduct | null> {
  const clean = norm(code);
  if (!clean || !isSupabaseConfigured) return null;
  try {
    for (const column of ["barcode", "sku"]) {
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .ilike(column, clean)
        .limit(1);
      const p = data?.[0];
      if (p) {
        return {
          product_id: String(p.id),
          product_name: String(p.name || ""),
          description: p.description || null,
          price: Number(p.price || p.offer_price || 0),
          stock: Number(p.stock_quantity ?? p.stock ?? 0),
          barcode: clean,
          category: p.category || null,
        };
      }
    }
    return null;
  } catch (err) {
    console.error("[lookupBarcode] failed:", err);
    return null;
  }
}

/**
 * Saves each item's barcode on its product. With `addStock`, stock goes up by
 * that many units and a RESTOCK line is written to the stock history.
 */
export async function assignBarcodes(
  items: { productId: string; barcode: string; addStock: number; labels: number }[],
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: "Database not connected" };
  try {
    for (const item of items) {
      const code = norm(item.barcode);
      if (!/^[A-Z0-9_-]{4,32}$/.test(code)) {
        throw new Error(`"${item.barcode}" is not a valid item code (4-32 letters, numbers, - or _).`);
      }

      const { data: clash } = await supabase
        .from("products")
        .select("id, name")
        .ilike("barcode", code)
        .neq("id", item.productId)
        .limit(1);
      if (clash && clash.length > 0) {
        throw new Error(`Item code ${code} is already used by "${clash[0].name}".`);
      }

      const { data: prod, error: readErr } = await supabase
        .from("products")
        .select("stock_quantity, stock")
        .eq("id", item.productId)
        .single();
      if (readErr) throw readErr;

      const before = Number(prod?.stock_quantity ?? prod?.stock ?? 0);
      const add = Math.max(0, Math.floor(item.addStock || 0));
      const update: Record<string, unknown> = { barcode: code };
      if (add > 0) {
        update.stock_quantity = before + add;
        update.stock = before + add;
      }
      const { error: upErr } = await supabase.from("products").update(update).eq("id", item.productId);
      if (upErr) throw upErr;

      if (add > 0) {
        await supabase.from("inventory_logs").insert({
          product_id: item.productId,
          old_quantity: before,
          new_quantity: before + add,
          adjustment: add,
          reason: `RESTOCK: Received via Barcode Generator (${item.labels} labels)`,
          reference_id: code,
        });
      }
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to save barcodes" };
  }
}
