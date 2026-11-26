import { MapPin, Clock, Phone, Store, Scissors, Camera, Mail } from "lucide-react";
import { BRAND_EN, BRAND_SUBTITLE, BRAND_OWNER_NAME, BRAND_ADDRESS, BRAND_PHONE_DISPLAY, BRAND_EMAIL, BRAND_INSTAGRAM, BRAND_INSTAGRAM_LINK } from "@/lib/brand";
import AppFooter from "@/app/components/AppFooter";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#FFF7EE] text-[#111111] font-sans flex flex-col justify-between selection:bg-[#A4164E] selection:text-white">
      {/* Header */}
      <header className="border-b border-[#A4164E]/20 py-4 px-6 sm:px-12 flex justify-between items-center bg-white/95 backdrop-blur-md sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#FDF1E6] ring-1 ring-[#B8893E]/40 shadow-xs">
            <img src="/logo.png" alt={`${BRAND_EN} Logo`} className="w-full h-full object-cover" />
          </div>
          <div>
            <span className="text-sm sm:text-base font-black text-[#A4164E] tracking-wider uppercase block">
              {BRAND_EN}
            </span>
            <span className="text-[10px] text-gray-600 font-bold tracking-widest block uppercase -mt-0.5">
              {BRAND_SUBTITLE}
            </span>
          </div>
        </div>
      </header>

      {/* Main Info */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-6 flex flex-col justify-center items-center py-12">
        <div className="bg-white border border-[#A4164E]/20 rounded-3xl p-8 sm:p-12 shadow-xl w-full text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#A4164E] via-[#C9A063] to-[#A4164E]" />

          <span className="inline-block px-3.5 py-1 bg-[#A4164E]/10 border border-[#A4164E]/30 text-[#A4164E] text-[11px] font-black rounded-full tracking-wider uppercase mb-6">
            Bridal Wear &amp; Covering
          </span>

          <h1 className="text-3xl sm:text-4xl font-black text-[#111111] leading-tight tracking-tight mb-2">
            {BRAND_EN}
          </h1>
          <p className="text-xs text-[#A4164E] font-black tracking-widest uppercase mb-2">
            {BRAND_SUBTITLE}
          </p>
          <p className="text-xs text-gray-500 font-bold mb-8">
            Proprietor: <span className="text-gray-900">{BRAND_OWNER_NAME}</span>
          </p>

          <div className="space-y-6 text-left max-w-lg mx-auto text-sm font-semibold text-[#111111]/80 border-t border-[#A4164E]/15 pt-8">
            <div className="flex items-start gap-4">
              <Scissors className="w-5 h-5 text-[#A4164E] shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Specializations</p>
                <p className="text-[#111111] leading-relaxed">
                  Bridal Wear • Designer Collections • Covering • Custom Orders
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Store className="w-5 h-5 text-[#A4164E] shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Location</p>
                <p className="text-[#111111] font-bold">
                  Pallavaram, Chennai, Tamil Nadu
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <MapPin className="w-5 h-5 text-[#A4164E] shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Shop Address</p>
                <p className="text-[#111111] leading-relaxed">
                  {BRAND_ADDRESS}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Phone className="w-5 h-5 text-[#A4164E] shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Contact Numbers</p>
                <p className="text-[#111111]">
                  +91 {BRAND_PHONE_DISPLAY}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Mail className="w-5 h-5 text-[#A4164E] shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Email</p>
                <p className="text-[#111111]">
                  {BRAND_EMAIL}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Camera className="w-5 h-5 text-[#A4164E] shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Instagram</p>
                <a
                  href={BRAND_INSTAGRAM_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#A4164E] hover:underline"
                >
                  @{BRAND_INSTAGRAM}
                </a>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Clock className="w-5 h-5 text-[#A4164E] shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Working Hours</p>
                <p className="text-[#111111]">
                  Open Daily • 10:00 AM – 8:00 PM
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <AppFooter className="px-6" />
    </div>
  );
}
