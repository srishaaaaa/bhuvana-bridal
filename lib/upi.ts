/** UPI helpers shared by billing (QR + WhatsApp link) and Store Settings. */

/** How a UPI payment reached the shop. Saved on the bill and shown on the invoice. */
export const UPI_VIA_OPTIONS = [
  'Counter QR',
  'WhatsApp payment link',
  "Guest's phone QR",
  'GPay number',
  'Other UPI',
] as const;
export type UpiVia = (typeof UPI_VIA_OPTIONS)[number];

/** name@handle, where the name may contain letters, digits, dot, dash and underscore. */
export const isValidUpiId = (value: string) => /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/.test((value || '').trim());

/** Short reference shown in the UPI app so the payment can be matched to the bill (e.g. P05W8CVE0). */
export const newPaymentNote = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let out = 'P';
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
};

type UpiPayParams = { upiId: string; payee: string; amount: number; note?: string };

/** Query string shared by every UPI app link (NPCI format). */
const upiQuery = ({ upiId, payee, amount, note }: UpiPayParams) => {
  const params = new URLSearchParams({
    pa: upiId.trim(),
    pn: (payee || '').trim().slice(0, 50),
    am: (Math.round((Number(amount) || 0) * 100) / 100).toFixed(2),
    cu: 'INR',
  });
  if (note) {
    params.set('tn', note.slice(0, 50));
    params.set('tr', note.slice(0, 35));
  }
  // URLSearchParams encodes spaces as "+" and "@" as "%40"; UPI apps expect %20 and a literal "@"
  // (several apps reject "%40" in the payee address as an invalid UPI ID).
  return params.toString().replace(/\+/g, '%20').replace(/%40/g, '@');
};

/** Standard UPI deep link that any UPI app understands (also what the QR encodes). */
export const buildUpiLink = (p: UpiPayParams) => `upi://pay?${upiQuery(p)}`;

/** App-specific links so a tap opens that app with payee, amount and note filled in. */
export const buildUpiAppLinks = (p: UpiPayParams) => {
  const q = upiQuery(p);
  return {
    gpay: `tez://upi/pay?${q}`,
    phonepe: `phonepe://pay?${q}`,
    paytm: `paytmmp://pay?${q}`,
    any: `upi://pay?${q}`,
  };
};

/** Public payment page link sent on WhatsApp (https, so WhatsApp makes it tappable). */
export const buildPayPageLink = (base: string, v: { amount: number; name?: string; note?: string }) => {
  const params = new URLSearchParams({ am: (Math.round((Number(v.amount) || 0) * 100) / 100).toFixed(2) });
  if (v.name && v.name.trim()) params.set('n', v.name.trim().slice(0, 40));
  if (v.note) params.set('tn', v.note.slice(0, 20));
  return `${base.replace(/\/+$/, '')}/pay?${params.toString()}`;
};

/** Site address for payment links: NEXT_PUBLIC_SITE_URL if set, else the address this app is open on. */
export const siteBaseUrl = () =>
  (process.env.NEXT_PUBLIC_SITE_URL || '').trim() || (typeof window !== 'undefined' ? window.location.origin : '');

/** True when customers' phones can't reach this address (localhost / private network). */
export const isPrivateAddress = (base: string) =>
  /^https?:\/\/(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(base);

/** 2500 -> "2,500", 2500.5 -> "2,500.50" */
const inr = (n: number) => {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  const decimals = Number.isInteger(v) ? 0 : 2;
  return v.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: 2 });
};

/** Fills the WhatsApp payment message template. Lines whose value is empty (e.g. no GPay number) are dropped. */
export const fillUpiMessage = (
  template: string,
  v: { name?: string; amount: number; shop: string; link: string; upiId: string; gpayNumber: string; bill?: string },
) => {
  const values: Record<string, string> = {
    name: (v.name || '').trim() || 'there',
    amount: inr(v.amount),
    shop: v.shop || '',
    link: v.link || '',
    upi: (v.upiId || '').trim(),
    gpay: (v.gpayNumber || '').trim(),
    bill: v.bill || '',
  };
  return template
    .split('\n')
    .filter(line => !/\{(upi|gpay|link|bill)\}/.test(line) || [...line.matchAll(/\{(upi|gpay|link|bill)\}/g)].every(m => values[m[1]]))
    .join('\n')
    .replace(/\{(name|amount|shop|link|upi|gpay|bill)\}/g, (_, k: string) => values[k]);
};
