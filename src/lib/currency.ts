import { useState, useEffect } from "react";

export type Currency = "GHS" | "NGN";

const DEFAULT_RATE = 115; // 1 GHS ≈ 115 NGN baseline
const STORAGE_KEY = "a1_preferred_currency";
const RATE_STORAGE_KEY = "a1_cached_ghs_ngn_rate";

// In-memory singletons to prevent multiple refetches
let cachedCurrency: Currency | null = null;
let cachedRate: number = DEFAULT_RATE;

/**
 * Detect user's preferred currency based on:
 * 1. User's saved explicit choice in localStorage
 * 2. Device timezone (Africa/Lagos → NGN)
 * 3. Fast IP country lookup (api.country.is)
 */
export async function detectUserCurrency(): Promise<Currency> {
  if (typeof window === "undefined") return "GHS";

  // 1. Saved preference
  const saved = localStorage.getItem(STORAGE_KEY) as Currency | null;
  if (saved === "GHS" || saved === "NGN") {
    cachedCurrency = saved;
    return saved;
  }

  // 2. Timezone heuristic (instant, no network)
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (tz.includes("Lagos") || tz.includes("Nigeria")) {
      cachedCurrency = "NGN";
      return "NGN";
    }
  } catch {}

  // 3. Fast IP Geolocation lookup
  try {
    const res = await fetch("https://api.country.is/", { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const data = await res.json();
      if (data?.country === "NG") {
        cachedCurrency = "NGN";
        return "NGN";
      }
    }
  } catch (err) {
    // Non-blocking fallback
  }

  cachedCurrency = "GHS";
  return "GHS";
}

/**
 * Fetch live exchange rate from GHS to NGN
 */
export async function fetchLiveExchangeRate(): Promise<number> {
  // Check cached rate from storage (valid for 6 hours)
  try {
    const cached = localStorage.getItem(RATE_STORAGE_KEY);
    if (cached) {
      const { rate, ts } = JSON.parse(cached);
      if (Date.now() - ts < 6 * 60 * 60 * 1000 && typeof rate === "number" && rate > 50) {
        cachedRate = rate;
        return rate;
      }
    }
  } catch {}

  try {
    const res = await fetch("https://open.er-api.com/v6/latest/GHS", { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      const liveRate = data?.rates?.NGN;
      if (typeof liveRate === "number" && liveRate > 50 && liveRate < 300) {
        // Round to clean integer rate (e.g. 115)
        const cleanRate = Math.round(liveRate);
        cachedRate = cleanRate;
        try {
          localStorage.setItem(RATE_STORAGE_KEY, JSON.stringify({ rate: cleanRate, ts: Date.now() }));
        } catch {}
        return cleanRate;
      }
    }
  } catch {}

  return DEFAULT_RATE;
}

export function convertGhsToNgn(ghsAmount: number, rate: number = cachedRate): number {
  return Math.ceil(ghsAmount * rate);
}

export function useCurrency() {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY) as Currency | null;
      if (saved === "GHS" || saved === "NGN") return saved;
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
        if (tz.includes("Lagos")) return "NGN";
      } catch {}
    }
    return cachedCurrency || "GHS";
  });

  const [rate, setRate] = useState<number>(() => cachedRate);
  const [isDetecting, setIsDetecting] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    // Detect currency if not manually set
    const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!saved) {
      detectUserCurrency().then((detected) => {
        if (mounted && detected !== currency) {
          setCurrencyState(detected);
        }
        if (mounted) setIsDetecting(false);
      });
    } else {
      setIsDetecting(false);
    }

    // Fetch live FX rate
    fetchLiveExchangeRate().then((liveRate) => {
      if (mounted) setRate(liveRate);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const setCurrency = (next: Currency) => {
    setCurrencyState(next);
    cachedCurrency = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  };

  /**
   * Formats a given GHS price based on current currency selection.
   * Provides both primary label and secondary conversion helper.
   */
  const formatPrice = (ghsAmount: number, originalGhs?: number | null) => {
    const ngnAmount = convertGhsToNgn(ghsAmount, rate);
    const originalNgn = originalGhs ? convertGhsToNgn(originalGhs, rate) : null;

    if (currency === "NGN") {
      return {
        currency: "NGN" as const,
        symbol: "₦",
        amountStr: ngnAmount.toLocaleString(),
        rawAmount: ngnAmount,
        originalStr: originalNgn ? `₦${originalNgn.toLocaleString()}` : null,
        secondaryStr: `≈ GHS ${ghsAmount}`,
        code: "NGN",
      };
    }

    return {
      currency: "GHS" as const,
      symbol: "GHS",
      amountStr: ghsAmount.toString(),
      rawAmount: ghsAmount,
      originalStr: originalGhs ? `GHS ${originalGhs}` : null,
      secondaryStr: `≈ ₦${ngnAmount.toLocaleString()}`,
      code: "GHS",
    };
  };

  return {
    currency,
    setCurrency,
    rate,
    isDetecting,
    convertGhsToNgn: (ghs: number) => convertGhsToNgn(ghs, rate),
    formatPrice,
  };
}
