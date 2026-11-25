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

/** Standard UPI deep link (NPCI format) that any UPI app understands. */
export const buildUpiLink = ({ upiId, payee, amount, note }: { upiId: string; payee: string; amount: number; note?: string }) => {
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
  // URLSearchParams encodes spaces as "+"; UPI apps expect %20.
  return `upi://pay?${params.toString().replace(/\+/g, '%20')}`;
};

const inr = (n: number) =>
  (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

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
