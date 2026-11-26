import { BRAND_EN } from "@/lib/brand";

/** The one footer used on every screen: a thin gold divider, then a single centred line. */
export default function AppFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={`mt-auto w-full pt-6 pb-3 ${className}`}>
      <div className="mx-auto mb-3 flex max-w-md items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#C9A063]/70" />
        <span className="h-1.5 w-1.5 rotate-45 bg-[#C9A063]" />
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#C9A063]/70" />
      </div>
      <p className="text-center text-[11px] font-medium tracking-wide text-gray-500">
        © 2026 {BRAND_EN}
        <span className="mx-2 text-[#C9A063]">•</span>
        Powered by{" "}
        <a
          href="https://www.cenexasystems.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-[#A4164E] hover:underline"
        >
          Cenexa Systems
        </a>
      </p>
    </footer>
  );
}
