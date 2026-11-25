import { Product } from './types';

export interface CatalogItem {
  id: string;
  name: string;
  category: 'BLOUSE ONLY' | 'SALWAR ONLY' | 'BASICS' | 'DIPLOMA' | 'FASHION DESIGNING DIPLOMA';
  price: number;
  unit: 'Pattern';
  duration: string;
  description?: string;
}

export const OFFICIAL_COURSE_CATEGORIES = ['ALL'] as const;

export type OfficialCourseCategory = (typeof OFFICIAL_COURSE_CATEGORIES)[number];

/**
 * Built-in starter catalogue. Intentionally empty: Bhuvana Bridal and Covering manages its
 * products in Inventory (Supabase). The old HM Boutique course list was removed.
 */
export const BROCHURE_CATALOGUE_ITEMS: CatalogItem[] = [];

export function catalogItemToProduct(item: CatalogItem): Product {
  return {
    id: item.id,
    sku: item.id.toUpperCase(),
    name: item.name,
    category: item.category,
    price: item.price,
    offer_price: item.price,
    selling_price: item.price,
    purchase_price: 0,
    gst_rate: 0,
    hsn_code: '9988',
    stock_quantity: 999,
    low_stock_alert: 5,
    unit: 'Pattern',
    unit_label: item.duration,
    item_type: 'service',
    is_active: true,
    created_at: new Date('2026-01-01').toISOString(),
    description: item.description || `${item.category} • ${item.duration}`,
    image_url: null,
  };
}
