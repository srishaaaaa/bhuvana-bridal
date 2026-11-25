/** Premium coupon ticket PDF, shared by the public coupon page. Uses only built-in PDF fonts (no ₹ glyph, so "Rs."). */

export type CouponShop = { name: string; phone: string; address: string; instagram: string };
export type CouponPdfData = { code: string; percentage: number; minOrder: number; expiry: string | null; personal: boolean };

const RUBY = "#A4164E";
const MAROON = "#5E0B2B";
const GOLD = "#C9A063";
const CREAM = "#FFF7EE";

const fmtDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
const inr = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

/** Draws the coupon as a vector PDF ticket (210 × 105 mm). `logo` is a JPEG/PNG data URL or null. */
export function buildCouponPdf(JsPDF: typeof import("jspdf").jsPDF, shop: CouponShop, c: CouponPdfData, customerName: string, logo: string | null) {
  const jsPDF = JsPDF;
  const W = 210;
  const H = 105;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [W, H] });

  // Page + ticket body
  doc.setFillColor(CREAM);
  doc.rect(0, 0, W, H, "F");
  doc.setFillColor("#FFFFFF");
  doc.setDrawColor(GOLD);
  doc.setLineWidth(0.6);
  doc.roundedRect(6, 6, W - 12, H - 12, 5, 5, "FD");

  // Left ruby panel
  const panelW = 66;
  doc.setFillColor(RUBY);
  doc.roundedRect(6, 6, panelW, H - 12, 5, 5, "F");
  doc.rect(6 + panelW - 6, 6, 6, H - 12, "F"); // square off the inner edge
  doc.setDrawColor(GOLD);
  doc.setLineWidth(0.4);
  doc.roundedRect(9, 9, panelW - 6, H - 18, 3.5, 3.5, "S");

  if (logo) {
    doc.setFillColor(CREAM);
    // Circle radius covers the square logo's corners (half-diagonal of 28 mm ≈ 19.8 mm).
    doc.circle(6 + panelW / 2, 36, 20.5, "F");
    doc.setDrawColor(GOLD);
    doc.setLineWidth(0.5);
    doc.circle(6 + panelW / 2, 36, 20.5, "S");
    doc.addImage(logo, "JPEG", 6 + panelW / 2 - 14, 22, 28, 28);
  }
  doc.setTextColor(GOLD);
  doc.setFont("times", "bold");
  const nameLines = doc.splitTextToSize(shop.name.toUpperCase(), panelW - 14);
  doc.setFontSize(nameLines.length > 1 ? 10.5 : 12);
  doc.text(nameLines, 6 + panelW / 2, 64, { align: "center", lineHeightFactor: 1.15 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor("#FFFFFF");
  // jsPDF's centring ignores charSpace, so centre manually.
  const tag = "EXCLUSIVE PRIVILEGE";
  const tagSpace = 0.6;
  const tagW = doc.getTextWidth(tag) + tagSpace * (tag.length - 1);
  doc.text(tag, 6 + panelW / 2 - tagW / 2, H - 15, { charSpace: tagSpace });

  // Perforation with notches
  const cutX = 6 + panelW;
  doc.setDrawColor(GOLD);
  doc.setLineWidth(0.35);
  doc.setLineDashPattern([1.6, 1.4], 0);
  doc.line(cutX, 12, cutX, H - 12);
  doc.setLineDashPattern([], 0);
  doc.setFillColor(CREAM);
  doc.circle(cutX, 6, 4, "F");
  doc.circle(cutX, H - 6, 4, "F");

  // Right content
  const x0 = cutX + 10;
  const right = W - 14;
  doc.setTextColor(GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(c.personal ? "A PERSONAL GIFT FOR YOU" : "EXCLUSIVE OFFER", x0, 20, { charSpace: 0.8 });
  if (customerName) {
    doc.setFont("times", "italic");
    doc.setFontSize(11);
    doc.setTextColor(MAROON);
    doc.text(`Specially for ${customerName}`, right, 20, { align: "right" });
  }

  doc.setFont("times", "bold");
  doc.setTextColor(RUBY);
  doc.setFontSize(46);
  doc.text(`${c.percentage}%`, x0, 42);
  const pctW = doc.getTextWidth(`${c.percentage}%`);
  doc.setFontSize(22);
  doc.text("OFF", x0 + pctW + 3, 42);

  doc.setFont("helvetica", "normal");
  doc.setTextColor("#3F3F46");
  doc.setFontSize(9.5);
  doc.text(c.minOrder > 0 ? `on your purchase of Rs. ${inr(c.minOrder)} and above` : "on your next purchase", x0, 50);

  // Code box
  doc.setDrawColor(RUBY);
  doc.setLineWidth(0.5);
  doc.setLineDashPattern([1.8, 1.2], 0);
  doc.setFillColor("#FDF1E6");
  doc.roundedRect(x0, 56, right - x0, 15, 2.5, 2.5, "FD");
  doc.setLineDashPattern([], 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor("#71717A");
  doc.text("COUPON CODE", x0 + 5, 61.5, { charSpace: 0.5 });
  doc.setFont("courier", "bold");
  doc.setFontSize(17);
  doc.setTextColor(MAROON);
  doc.text(c.code, x0 + 5, 68.3, { charSpace: 1.2 });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(RUBY);
  doc.text(c.expiry ? `Valid till ${fmtDate(c.expiry)}` : "No expiry", right - 5, 66, { align: "right" });

  // Terms + contact
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor("#71717A");
  const terms = [
    "Show this coupon at the billing counter.",
    c.personal ? "Valid only for the mobile number it was sent to." : "Cannot be combined with other offers.",
  ];
  doc.text(terms, x0, 77.5, { lineHeightFactor: 1.4 });
  doc.setDrawColor("#E7D9C4");
  doc.setLineWidth(0.3);
  doc.line(x0, 83.5, right, 83.5);
  doc.setFontSize(7);
  doc.setTextColor("#52525B");
  const contact = [shop.address, [shop.phone && `Ph: ${shop.phone}`, shop.instagram && `Instagram: @${shop.instagram}`].filter(Boolean).join("   ·   ")]
    .filter(Boolean)
    .map((l) => doc.splitTextToSize(l as string, right - x0)[0]);
  doc.text(contact, x0, 88, { lineHeightFactor: 1.45 });

  return doc;
}

export const couponPdfFileName = (shop: CouponShop, c: CouponPdfData) =>
  `${shop.name.replace(/[^A-Za-z0-9]+/g, "-")}-${c.code}.pdf`;

