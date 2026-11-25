-- Coupon sharing via WhatsApp + "only for customers it's sent to".
-- Safe to run more than once.
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS sent_only   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS sent_phones TEXT[]  NOT NULL DEFAULT '{}';
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS sent_count  INTEGER NOT NULL DEFAULT 0;
