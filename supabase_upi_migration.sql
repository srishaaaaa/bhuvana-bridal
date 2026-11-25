-- UPI payment settings (Store Settings -> UPI Payments). Safe to run more than once.
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS upi_id          TEXT;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS upi_payee_name  TEXT;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS gpay_number     TEXT;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS upi_message     TEXT;
