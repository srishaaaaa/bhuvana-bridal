"use client";

import { useEffect } from "react";
import { applyShopProfile, isProfileStale, profileFromSettings } from "@/lib/brand";
import { fetchStoreSettings } from "@/app/pos/actions";

/**
 * Loads the shop profile saved in Store Settings and applies it app-wide.
 * If it differs from this browser's cached copy, the page reloads once so
 * every header, invoice and receipt picks up the new details.
 */
export default function ShopProfileSync() {
  useEffect(() => {
    // Customer-facing payment page reads its own details; never reload it.
    if (/^\/(pay|coupon)(\/|$)/.test(window.location.pathname)) return;
    let cancelled = false;
    (async () => {
      try {
        const row = await fetchStoreSettings();
        if (cancelled || !row) return;
        const profile = profileFromSettings(row);
        const stale = isProfileStale(profile);
        applyShopProfile(profile);
        // Reload only if the new profile was actually cached (avoids a reload loop
        // when browser storage is blocked).
        if (stale && !isProfileStale(profile)) window.location.reload();
      } catch {
        // Offline or DB unavailable: keep cached/default profile
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return null;
}
