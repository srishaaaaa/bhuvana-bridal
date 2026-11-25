/**
 * WhatsApp "click to chat" links.
 *
 * Always use api.whatsapp.com/send, never wa.me: the wa.me short link re-encodes the text on its
 * redirect, and WhatsApp Desktop then shows every emoji and non-English character (✨, ₹, தமிழ்)
 * as "�". api.whatsapp.com/send passes the UTF-8 text through untouched.
 */

/** Digits with the +91 country code added to 10-digit Indian numbers; "" if not a usable number. */
export const whatsappNumber = (phone: string): string => {
  let d = (phone || '').replace(/\D/g, '').replace(/^0+/, '');
  if (d.length === 10) d = `91${d}`;
  return d.length >= 11 ? d : '';
};

/** Chat link for a number with the message filled in. Without a usable number, opens the contact picker. */
export const whatsappUrl = (phone: string | null | undefined, text?: string): string => {
  const params = new URLSearchParams();
  const num = whatsappNumber(phone || '');
  if (num) params.set('phone', num);
  if (text) params.set('text', text);
  // URLSearchParams writes spaces as "+"; WhatsApp expects %20.
  return `https://api.whatsapp.com/send?${params.toString().replace(/\+/g, '%20')}`;
};
