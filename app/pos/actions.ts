"use server";

import { dbStore } from "@/lib/dbStore";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { validateCoupon } from "@/lib/services/couponService";
import { measurementStore } from "@/lib/measurementStore";
import type { ActionResult, MeasurementOption, MeasurementOrder, MeasurementOrderInput, MeasurementStatus, OptionKind } from "@/lib/measurements";
import { Product, OrderWithRelations, CartItem, Expense, PaymentMode, Category, AdvanceOrderWithRelations, AdvanceOrderStatus } from "@/lib/types";

// Helper to serialize Date objects from Postgres to strings
function serialize<T>(data: T): T {
  if (data === null || data === undefined) return data;
  return JSON.parse(JSON.stringify(data));
}

export async function verifyPasscode(enteredPasscode: string): Promise<{ success: boolean; role?: 'staff' | 'admin' }> {
  const adminPasscode = process.env.ADMIN_PASSCODE || "admin123";
  const staffPasscode = process.env.STAFF_PASSCODE || process.env.NEXT_PUBLIC_STAFF_PASSCODE || "staff123";

  const normalizedEntered = enteredPasscode.replace(/\s/g, "");

  if (normalizedEntered === adminPasscode) {
    return { success: true, role: 'admin' };
  }
  if (normalizedEntered === staffPasscode) {
    return { success: true, role: 'staff' };
  }

  return { success: false };
}

// Categories
export async function fetchCategories(): Promise<Category[]> {
  return serialize(await dbStore.listCategories());
}

export async function createCategory(name: string): Promise<Category> {
  return serialize(await dbStore.addCategory(name.trim()));
}

export async function renameCategory(id: string, name: string): Promise<Category | null> {
  return serialize(await dbStore.updateCategory(id, name.trim()));
}

export async function removeCategory(id: string): Promise<void> {
  return await dbStore.deleteCategory(id);
}

// Products
export async function fetchProducts(): Promise<Product[]> {
  return serialize(await dbStore.listProducts());
}

export async function createProduct(data: {
  name: string;
  description: string | null;
  category: string;
  gst_rate: number;
  hsn_code: string | null;
  selling_price: number;
  sku?: string;
  stock_quantity?: number;
  low_stock_alert?: number;
  purchase_price?: number;
  item_type?: 'product' | 'service';
}): Promise<Product> {
  return serialize(await dbStore.addProduct(data));
}

export async function editProduct(id: string, data: Partial<Product>): Promise<Product | null> {
  return serialize(await dbStore.updateProduct(id, data));
}

export async function removeProduct(id: string): Promise<void> {
  return await dbStore.deleteProduct(id);
}

export async function adjustProductStock(data: {
  productId: string | number;
  adjustment: number;
  reason: string;
  referenceId?: string;
  oldQuantity: number;
  newQuantity: number;
}): Promise<void> {
  return await dbStore.adjustStock(data);
}

export type StockMovementRow = {
  id: string;
  product_id: string | null;
  product_name: string;
  old_quantity: number | null;
  new_quantity: number | null;
  adjustment: number;
  reason: string;
  reference_id: string | null;
  created_at: string;
};

/** Stock change history (newest first) with product names attached. */
export async function fetchStockMovements(): Promise<StockMovementRow[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data: logs, error } = await supabase
      .from('inventory_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5000);
    if (error) throw error;
    const { data: products } = await supabase.from('products').select('id, name');
    const names = new Map((products || []).map((p: any) => [String(p.id), String(p.name || '')]));
    return serialize(
      (logs || []).map((l: any) => ({
        id: String(l.id),
        product_id: l.product_id ?? null,
        product_name: names.get(String(l.product_id)) || 'Deleted product',
        old_quantity: l.old_quantity ?? null,
        new_quantity: l.new_quantity ?? null,
        adjustment: Number(l.adjustment || 0),
        reason: String(l.reason || ''),
        reference_id: l.reference_id ?? null,
        created_at: String(l.created_at),
      })),
    );
  } catch (err) {
    console.error('Failed to fetch stock movements:', err);
    return [];
  }
}

export async function seedCatalog(): Promise<{
  categoriesSeeded: number;
  productsSeeded: number;
  duplicatesRemoved: number;
  errors: string[];
}> {
  return serialize(await dbStore.seedCatalog());
}

// Orders
export async function fetchOrders(): Promise<OrderWithRelations[]> {
  return serialize(await dbStore.listOrdersWithRelations());
}

export async function fetchOrderById(id: string): Promise<OrderWithRelations | null> {
  return serialize(await dbStore.getOrderWithRelations(id));
}

export async function orderIdExists(id: string): Promise<boolean> {
  return await dbStore.orderIdExists(id);
}

export async function submitOrder(payload: {
  orderId: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string | null;
  source: 'ONLINE' | 'OFFLINE';
  isGst: boolean;
  billDate: string;
  items: CartItem[];
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  discountAmount: number;
  gstPercentage: number;
  gstAmount: number;
  deliveryFee: number;
  grandTotal: number;
  cashReceived: number;
  splitCash?: number;
  splitGpay?: number;
  paymentMode: PaymentMode;
  couponCode?: string | null;
  taxMode?: 'exclusive' | 'inclusive';
  manualDiscountAmount?: number;
  couponDiscountAmount?: number;
  remarks?: string | null;
  referenceNumber?: string | null;
  creditDueDate?: string | null;
}): Promise<{ orderId: string; id?: string; invoiceNo?: string }> {
  const result = await dbStore.submitOrder(payload);
  await recordCouponUse(payload.couponCode);
  return result;
}

export async function removeOrder(id: string): Promise<void> {
  return await dbStore.deleteOrder(id);
}

export async function markCreditOrderPaid(orderId: string): Promise<void> {
  return await dbStore.markCreditOrderPaid(orderId);
}

export async function updateCreditDueDate(orderId: string, dueDate: string): Promise<void> {
  return await dbStore.updateCreditDueDate(orderId, dueDate);
}

// Expenses
export async function fetchExpenses(): Promise<Expense[]> {
  return serialize(await dbStore.listExpenses());
}

export async function createExpense(data: {
  id?: string;
  title: string;
  category: string;
  amount: number;
  payment_mode: string;
  notes: string | null;
  expense_date: string;
}): Promise<Expense> {
  return serialize(await dbStore.addExpense(data));
}

export async function editExpense(id: string, data: Partial<Expense>): Promise<Expense | null> {
  return serialize(await dbStore.updateExpense(id, data));
}

export async function removeExpense(id: string): Promise<void> {
  return await dbStore.deleteExpense(id);
}

// Advance Orders (partial-payment holds)
export async function fetchAdvanceOrders(): Promise<AdvanceOrderWithRelations[]> {
  return serialize(await dbStore.listAdvanceOrders());
}

export async function fetchAdvanceOrderById(id: string): Promise<AdvanceOrderWithRelations | null> {
  return serialize(await dbStore.getAdvanceOrder(id));
}

export async function advanceOrderIdExists(id: string): Promise<boolean> {
  return await dbStore.advanceOrderIdExists(id);
}

export async function createAdvanceOrder(payload: {
  advanceOrderId: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string | null;
  subtotal: number;
  totalAmount: number;
  depositAmount: number;
  depositPaymentMode: PaymentMode;
  deliveryDate: string | null;
  notes: string | null;
  isGst?: boolean;
  gstPercentage?: number;
  gstAmount?: number;
  discountAmount?: number;
  discountType?: 'PERCENT' | 'FIXED';
  discountValue?: number;
  taxMode?: 'exclusive' | 'inclusive';
  manualDiscountAmount?: number;
  couponDiscountAmount?: number;
  couponCode?: string | null;
  depositSplitCash?: number;
  depositSplitGpay?: number;
  deliveryFee?: number;
  items: {
    product_id: string | null;
    snapshot_name: string;
    snapshot_desc: string | null;
    snapshot_price: number;
    quantity: number;
  }[];
}): Promise<{ advanceOrderId: string }> {
  const result = await dbStore.createAdvanceOrder(payload);
  await recordCouponUse(payload.couponCode);
  return result;
}

export async function setAdvanceOrderStatus(id: string, status: AdvanceOrderStatus): Promise<void> {
  // Freeze: a Completed order can never move to another status (COMPLETED -> COMPLETED stays allowed).
  if (status !== 'COMPLETED' && isSupabaseConfigured) {
    const isUuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const q = supabase.from('advance_orders').select('status');
    const { data } = await (isUuidLike ? q.or(`id.eq.${id},deposit_id.eq.${id}`) : q.eq('deposit_id', id)).limit(1);
    if (String(data?.[0]?.status || '').toLowerCase() === 'completed') {
      throw new Error('Completed orders are locked and cannot be changed.');
    }
  }
  return await dbStore.updateAdvanceOrderStatus(id, status);
}

export async function cancelAdvanceOrder(id: string): Promise<void> {
  return await dbStore.cancelAdvanceOrder(id);
}

export async function removeAdvanceOrder(id: string): Promise<void> {
  return await dbStore.deleteAdvanceOrder(id);
}

export async function finalizeAdvanceOrder(payload: {
  advanceOrderId: string;
  invoiceId: string;
  isGst: boolean;
  gstPercentage: number;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  discountAmount: number;
  deliveryFee: number;
  paymentMode: PaymentMode;
  billDate: string;
  manualDiscountAmount?: number;
  couponDiscountAmount?: number;
  couponCode?: string | null;
  splitCash?: number;
  splitGpay?: number;
}): Promise<{ orderId: string; error?: string }> {
  try {
    return await dbStore.finalizeAdvanceOrder(payload);
  } catch (e: any) {
    console.error('finalizeAdvanceOrder failed:', e);
    return { orderId: '', error: e?.message || String(e) };
  }
}

// Coupon validation & management
export async function checkCoupon(code: string, subtotal: number, customerPhone?: string) {
  return await validateCoupon(code, subtotal, customerPhone);
}

const COUPON_MIGRATION_HINT =
  'Coupon sharing needs a database update: run supabase_coupon_sharing_migration.sql in Supabase.';

const friendlyCouponError = (err: any, fallback: string) => {
  const msg = String(err?.message || '');
  if (/sent_only|sent_phones|sent_count/.test(msg)) return COUPON_MIGRATION_HINT;
  return msg || fallback;
};

/** Counts one redemption of a coupon (called after a bill is saved). Never throws. */
async function recordCouponUse(code?: string | null) {
  const clean = (code || '').trim();
  if (!clean || !isSupabaseConfigured) return;
  try {
    const { data } = await supabase.from('coupons').select('id, usage_count').ilike('code', clean).limit(1);
    const row = data?.[0];
    if (!row) return;
    await supabase.from('coupons').update({ usage_count: Number(row.usage_count || 0) + 1 }).eq('id', row.id);
  } catch (err) {
    console.error('Failed to record coupon use:', err);
  }
}

/** Logs a WhatsApp send. With a phone, the number is remembered for "sent only" coupons. */
export async function recordCouponSent(id: number, phone?: string | null) {
  if (!isSupabaseConfigured) return { success: false, error: 'Database not configured' };
  try {
    const { data, error } = await supabase.from('coupons').select('sent_phones, sent_count').eq('id', id).single();
    if (error) throw error;
    const phones: string[] = Array.isArray(data?.sent_phones) ? data.sent_phones : [];
    const digits = (phone || '').replace(/\D/g, '').slice(-10);
    const nextPhones = digits && !phones.includes(digits) ? [...phones, digits] : phones;
    const { error: upErr } = await supabase
      .from('coupons')
      .update({ sent_phones: nextPhones, sent_count: Number(data?.sent_count || 0) + 1 })
      .eq('id', id);
    if (upErr) throw upErr;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: friendlyCouponError(err, 'Failed to record send') };
  }
}

export async function fetchCoupons() {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return serialize(data || []);
  } catch (err) {
    console.error('Failed to fetch coupons:', err);
    return [];
  }
}

export async function saveCoupon(payload: {
  id?: number | null;
  code: string;
  percentage: number;
  expiry_date?: string | null;
  usage_limit?: number | null;
  min_order_value?: number;
  is_active?: boolean;
  sent_only?: boolean;
}) {
  if (!isSupabaseConfigured) return { success: false, error: 'Database not configured' };
  try {
    const dataPayload: any = {
      percentage: Number(payload.percentage) || 0,
      expiry_date: payload.expiry_date || null,
      usage_limit: payload.usage_limit ? Number(payload.usage_limit) : null,
      min_order_value: Number(payload.min_order_value) || 0,
    };
    // Only send the column when it matters, so the screen still works before the migration runs.
    if (payload.sent_only || payload.id) dataPayload.sent_only = !!payload.sent_only;

    if (payload.id) {
      if (typeof payload.is_active === 'boolean') dataPayload.is_active = payload.is_active;
      const { error } = await supabase.from('coupons').update(dataPayload).eq('id', payload.id);
      if (error) throw error;
      return { success: true };
    } else {
      dataPayload.code = payload.code.toUpperCase().trim();
      dataPayload.is_active = true;
      const { error } = await supabase.from('coupons').insert(dataPayload);
      if (error) throw error;
      return { success: true };
    }
  } catch (err: any) {
    return { success: false, error: friendlyCouponError(err, 'Failed to save coupon') };
  }
}

export async function deleteCoupon(id: number) {
  if (!isSupabaseConfigured) return { success: false, error: 'Database not configured' };
  try {
    const { error } = await supabase.from('coupons').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete coupon' };
  }
}

export async function toggleCouponActive(id: number, currentStatus: boolean) {
  if (!isSupabaseConfigured) return { success: false, error: 'Database not configured' };
  try {
    const { error } = await supabase.from('coupons').update({ is_active: !currentStatus }).eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to toggle coupon' };
  }
}

// Store settings
export async function fetchStoreSettings() {
  if (!isSupabaseConfigured) return null;
  try {
    const { data } = await supabase.from('store_settings').select('*').limit(1).single();
    return serialize(data);
  } catch {
    return null;
  }
}

export async function saveStoreSettings(settings: {
  name: string;
  ownerName: string;
  businessType: string;
  phone: string;
  shopContact: string;
  email: string;
  address: string;
  instagramId: string;
  logoUrl?: string;
  cardColor?: string;
}) {
  if (!isSupabaseConfigured) return { success: false, error: 'Database not connected' };
  try {
    const payload = {
      name: settings.name,
      owner_name: settings.ownerName,
      business_type: settings.businessType,
      phone: settings.phone,
      shop_contact: settings.shopContact,
      email: settings.email,
      address: settings.address,
      instagram_id: settings.instagramId,
      logo_url: settings.logoUrl || '/logo.png',
      card_color: settings.cardColor || '#A4164E',
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('store_settings').upsert({ id: 1, ...payload });
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to save settings' };
  }
}

// Measurements (errors are returned, not thrown, so production shows the real message)
async function guard<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { success: true, data: serialize(await fn()) };
  } catch (e) {
    return { success: false, error: (e as Error)?.message || "Unexpected error" };
  }
}

export async function fetchMeasurements(): Promise<ActionResult<MeasurementOrder[]>> {
  return guard(() => measurementStore.list());
}

export async function createMeasurementOrder(input: MeasurementOrderInput): Promise<ActionResult<MeasurementOrder>> {
  return guard(() => measurementStore.create(input));
}

export async function updateMeasurementStatus(id: string, status: MeasurementStatus): Promise<ActionResult<void>> {
  return guard(() => measurementStore.setStatus(id, status));
}

export async function removeMeasurement(id: string): Promise<ActionResult<void>> {
  return guard(() => measurementStore.remove(id));
}

export async function fetchMeasurementOptions(): Promise<ActionResult<MeasurementOption[]>> {
  return guard(() => measurementStore.listOptions());
}

export async function createMeasurementOption(kind: OptionKind, name: string): Promise<ActionResult<MeasurementOption>> {
  return guard(() => measurementStore.addOption(kind, name));
}

export async function renameMeasurementOption(id: string, name: string): Promise<ActionResult<MeasurementOption>> {
  return guard(() => measurementStore.renameOption(id, name));
}

export async function removeMeasurementOption(id: string): Promise<ActionResult<void>> {
  return guard(() => measurementStore.removeOption(id));
}
