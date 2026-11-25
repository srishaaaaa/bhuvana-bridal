import { isSupabaseConfigured, supabase } from '../supabase'


export type AppliedCoupon = {
  code: string
  percentage: number
  discount: number
}

export async function validateCoupon(
  rawCode: string,
  subtotal: number,
  customerPhone?: string,
): Promise<{ data: AppliedCoupon | null; error: string | null }> {
  const code = rawCode.trim().toUpperCase()

  if (!isSupabaseConfigured) {
    return { data: null, error: 'Coupon validation requires a live database connection' }
  }

  try {
    const { data, error: dbErr } = await supabase
      .from('coupons')
      .select('*')
      .eq('is_active', true)
      .ilike('code', code)
      .single()

    if (dbErr || !data) return { data: null, error: 'Invalid or expired coupon code' }

    if (data.expiry_date && new Date(data.expiry_date) < new Date()) {
      return { data: null, error: 'This coupon has expired' }
    }

    if (data.sent_only) {
      const phone = (customerPhone || '').replace(/\D/g, '').slice(-10)
      if (!phone) return { data: null, error: 'Enter the customer mobile number to use this coupon' }
      const allowed: string[] = Array.isArray(data.sent_phones) ? data.sent_phones : []
      if (!allowed.includes(phone)) {
        return { data: null, error: 'This coupon was not sent to this mobile number' }
      }
    }

    const usageLimit = Number(data.usage_limit || 0)
    const usageCount = Number(data.usage_count || 0)
    if (usageLimit > 0 && usageCount >= usageLimit) {
      return { data: null, error: 'Coupon usage limit has been reached' }
    }

    if (data.min_order_value && subtotal < Number(data.min_order_value)) {
      return {
        data: null,
        error: `Minimum order of ₹${Number(data.min_order_value).toFixed(2)} required`,
      }
    }

    const discount = Math.round((subtotal * Number(data.percentage) / 100) * 100) / 100
    return {
      data: { code: String(data.code), percentage: Number(data.percentage), discount },
      error: null,
    }
  } catch {
    return { data: null, error: 'Failed to validate coupon. Try again.' }
  }
}
