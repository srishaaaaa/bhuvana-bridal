/**
 * Shop / company profile used everywhere the app shows shop details
 * (navbar, footer, invoice header, PDF, thermal receipt, admin shell...).
 *
 * Single source of truth dynamically synced with Store Settings.
 */

const PROFILE_CACHE_KEY = 'shop-profile'
const LOGO_DATA_CACHE_KEY = 'shop-logo-data'

export interface ShopProfile {
  name: string
  ownerName: string
  businessType: string
  phone: string
  shopContact: string
  email: string
  address: string
  instagramId: string
  logoUrl: string
  /** UPI ID (VPA) that QR codes and payment links pay to, e.g. 6383950458@okaxis */
  upiId: string
  /** Name shown in the customer's UPI app; blank = shop name */
  upiPayeeName: string
  /** Number customers can pay on GPay directly */
  gpayNumber: string
  /** WhatsApp message for UPI payment requests */
  upiMessage: string
}

export const DEFAULT_UPI_MESSAGE = `Hi {name}, thank you for shopping at {shop}! 🌸

Your bill amount is *₹{amount}*.

Tap to pay by UPI:
{link}

UPI ID: {upi}
GPay number: {gpay}

Please share the payment screenshot once done. 🙏`

/** Fallback used before settings load. */
export const DEFAULT_SHOP_PROFILE: ShopProfile = {
  name: 'Bhuvana Bridal and Covering',
  ownerName: '',
  businessType: '',
  phone: '63839 50458',
  shopContact: '63839 50458',
  email: 'bhuvanabridalandcovering@gmail.com',
  address: 'Ground floor, No. 8/24, Indhira Gandhi Road, Pallavaram',
  instagramId: 'bhuvana_bridal_covering',
  logoUrl: '/logo.png',
  upiId: '',
  upiPayeeName: '',
  gpayNumber: '63839 50458',
  upiMessage: DEFAULT_UPI_MESSAGE,
}

export const DEFAULT_LOGO = '/logo.png'

export const DEFAULT_INVOICE_TERMS: string[] = [
  "Thank you for choosing Bhuvana Bridal and Covering.",
  "Please carry this receipt when collecting your order.",
];

const readCachedProfile = (): ShopProfile => {
  if (typeof window === 'undefined') return DEFAULT_SHOP_PROFILE
  try {
    const raw = window.localStorage.getItem(PROFILE_CACHE_KEY)
    if (!raw) return DEFAULT_SHOP_PROFILE
    const parsed = JSON.parse(raw) as Partial<ShopProfile>
    return { ...DEFAULT_SHOP_PROFILE, ...parsed }
  } catch {
    return DEFAULT_SHOP_PROFILE
  }
}

/** Digits-only form for tel:/wa.me links, defaulting to the +91 country code. */
export const toE164 = (display: string): string => {
  const digits = (display || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 10) return `91${digits}`
  return digits
}

export const toInstagramHandle = (value: string) => (value || '').trim().replace(/^@+/, '')
export const toInstagramLink = (value: string) => {
  const handle = toInstagramHandle(value)
  if (!handle) return '#'
  return `https://www.instagram.com/${handle.replace(/\s+/g, '')}/`
}

// -- Live brand bindings ------------------------------------------------
export let BRAND_EN = DEFAULT_SHOP_PROFILE.name
export let BRAND_SUBTITLE = DEFAULT_SHOP_PROFILE.businessType
export let BRAND_OWNER_NAME = DEFAULT_SHOP_PROFILE.ownerName
export let BRAND_LOGO = DEFAULT_LOGO

export let BRAND_PRIMARY_PHONE_DISPLAY = DEFAULT_SHOP_PROFILE.phone
export let BRAND_PRIMARY_PHONE_E164 = toE164(DEFAULT_SHOP_PROFILE.phone)
export let BRAND_SECONDARY_PHONE_DISPLAY = DEFAULT_SHOP_PROFILE.shopContact
export let BRAND_SECONDARY_PHONE_E164 = toE164(DEFAULT_SHOP_PROFILE.shopContact)
export let BRAND_THIRD_PHONE_DISPLAY = DEFAULT_SHOP_PROFILE.shopContact
export let BRAND_THIRD_PHONE_E164 = toE164(DEFAULT_SHOP_PROFILE.shopContact)
export let BRAND_PHONE_DISPLAY = DEFAULT_SHOP_PROFILE.phone
export let BRAND_PHONE_E164 = toE164(DEFAULT_SHOP_PROFILE.phone)
export let BRAND_WHATSAPP = DEFAULT_SHOP_PROFILE.shopContact
export let WHATSAPP_NUM = toE164(DEFAULT_SHOP_PROFILE.shopContact)
export let BRAND_WHATSAPP_LINK = `https://wa.me/${toE164(DEFAULT_SHOP_PROFILE.shopContact)}`
export let BRAND_EMAIL = DEFAULT_SHOP_PROFILE.email
export let BRAND_ADDRESS = DEFAULT_SHOP_PROFILE.address
export const BRAND_LOCATION_LINK = '#'
export let BRAND_INSTAGRAM = toInstagramHandle(DEFAULT_SHOP_PROFILE.instagramId)
export let BRAND_INSTAGRAM_LINK = toInstagramLink(DEFAULT_SHOP_PROFILE.instagramId)
export let BRAND_UPI_ID = DEFAULT_SHOP_PROFILE.upiId
export let BRAND_UPI_PAYEE = DEFAULT_SHOP_PROFILE.name
export let BRAND_GPAY_NUMBER = DEFAULT_SHOP_PROFILE.gpayNumber
export let BRAND_UPI_MESSAGE = DEFAULT_SHOP_PROFILE.upiMessage

/** Maps a store_settings row (snake_case or camelCase) to a ShopProfile. */
export const profileFromSettings = (row: any): ShopProfile => ({
  name: row?.name || DEFAULT_SHOP_PROFILE.name,
  ownerName: row?.owner_name ?? row?.ownerName ?? DEFAULT_SHOP_PROFILE.ownerName,
  businessType: row?.business_type ?? row?.businessType ?? DEFAULT_SHOP_PROFILE.businessType,
  phone: row?.phone || DEFAULT_SHOP_PROFILE.phone,
  shopContact: row?.shop_contact ?? row?.shopContact ?? DEFAULT_SHOP_PROFILE.shopContact,
  email: row?.email ?? DEFAULT_SHOP_PROFILE.email,
  address: row?.address ?? DEFAULT_SHOP_PROFILE.address,
  instagramId: row?.instagram_id ?? row?.instagramId ?? DEFAULT_SHOP_PROFILE.instagramId,
  logoUrl: row?.logo_url || row?.logoUrl || DEFAULT_SHOP_PROFILE.logoUrl,
  upiId: row?.upi_id ?? row?.upiId ?? DEFAULT_SHOP_PROFILE.upiId,
  upiPayeeName: row?.upi_payee_name ?? row?.upiPayeeName ?? DEFAULT_SHOP_PROFILE.upiPayeeName,
  gpayNumber: row?.gpay_number ?? row?.gpayNumber ?? DEFAULT_SHOP_PROFILE.gpayNumber,
  upiMessage: row?.upi_message || row?.upiMessage || DEFAULT_SHOP_PROFILE.upiMessage,
})

/** True when the given profile differs from what this browser has cached. */
export const isProfileStale = (profile: ShopProfile): boolean =>
  JSON.stringify(readCachedProfile()) !== JSON.stringify({ ...DEFAULT_SHOP_PROFILE, ...profile })

/** Point every brand binding at the saved shop profile. */
export const applyShopProfile = (profile: Partial<ShopProfile>, cache = true) => {
  const next: ShopProfile = { ...DEFAULT_SHOP_PROFILE, ...profile }

  BRAND_EN = next.name || DEFAULT_SHOP_PROFILE.name
  BRAND_SUBTITLE = next.businessType || ''
  BRAND_OWNER_NAME = next.ownerName || ''
  BRAND_LOGO = next.logoUrl || DEFAULT_LOGO

  BRAND_PRIMARY_PHONE_DISPLAY = next.phone || ''
  BRAND_PRIMARY_PHONE_E164 = toE164(next.phone)
  BRAND_SECONDARY_PHONE_DISPLAY = next.shopContact || next.phone || ''
  BRAND_SECONDARY_PHONE_E164 = toE164(next.shopContact || next.phone)
  BRAND_THIRD_PHONE_DISPLAY = BRAND_SECONDARY_PHONE_DISPLAY
  BRAND_THIRD_PHONE_E164 = BRAND_SECONDARY_PHONE_E164
  BRAND_PHONE_DISPLAY = BRAND_PRIMARY_PHONE_DISPLAY
  BRAND_PHONE_E164 = BRAND_PRIMARY_PHONE_E164
  BRAND_WHATSAPP = BRAND_SECONDARY_PHONE_DISPLAY
  WHATSAPP_NUM = BRAND_SECONDARY_PHONE_E164
  BRAND_WHATSAPP_LINK = `https://wa.me/${BRAND_SECONDARY_PHONE_E164}`

  BRAND_EMAIL = next.email || ''
  BRAND_ADDRESS = next.address || ''
  BRAND_INSTAGRAM = toInstagramHandle(next.instagramId)
  BRAND_INSTAGRAM_LINK = toInstagramLink(next.instagramId)
  BRAND_UPI_ID = (next.upiId || '').trim()
  BRAND_UPI_PAYEE = (next.upiPayeeName || '').trim() || BRAND_EN
  BRAND_GPAY_NUMBER = (next.gpayNumber || '').trim()
  BRAND_UPI_MESSAGE = next.upiMessage || DEFAULT_UPI_MESSAGE

  if (cache && typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(next))
    } catch {
      // Ignore storage failures
    }
  }
}

// Hydrate synchronously from cache
if (typeof window !== 'undefined') {
  applyShopProfile(readCachedProfile(), false)
}

export const setShopLogoDataUrl = (dataUrl: string | null) => {
  if (typeof window === 'undefined') return
  try {
    if (dataUrl) window.localStorage.setItem(LOGO_DATA_CACHE_KEY, dataUrl)
    else window.localStorage.removeItem(LOGO_DATA_CACHE_KEY)
  } catch {
    // Ignore storage failures
  }
}

export const getShopLogoDataUrl = (): string | null => {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(LOGO_DATA_CACHE_KEY)
  } catch {
    return null
  }
}
