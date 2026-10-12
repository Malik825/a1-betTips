import { useState, useEffect } from "react";

export type Currency = "GHS" | "NGN";

const DEFAULT_RATE = 115; // 1 GHS ≈ 115 NGN baseline
const STORAGE_KEY = "a1_preferred_currency";
const RATE_STORAGE_KEY = "a1_cached_ghs_ngn_rate";

// In-memory singletons to prevent multiple refetches
let cachedCurrency: Currency | null = null;
let cachedRate: number = DEFAULT_RATE;

/**
 * Fast IP country lookup with fallback
 */
async function detectCountryCode(): Promise<string> {
  // 1. Primary: api.country.is
  try {
    const res = await fetch("https://api.country.is/", { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (data?.country && typeof data.country === "string") {
        return data.country.toUpperCase();
      }
    }
  } catch {}

  // 2. Secondary fallback: ipapi.co
  try {
    const res = await fetch("https://ipapi.co/country/", { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const text = (await res.text()).trim().toUpperCase();
      if (text.length === 2) return text;
    }
  } catch {}

  return "GH"; // Default to Ghana
}

/**
 * Detect user's preferred currency based on:
 * 1. Explicit user manual selection (if user explicitly toggled)
 * 2. Real IP Geolocation (Nigeria -> NGN, Ghana & rest of world -> GHS)
 */
export async function detectUserCurrency(): Promise<Currency> {
  if (typeof window === "undefined") return "GHS";

  // Check if user made an explicit manual choice
  const isManual = localStorage.getItem("a1_currency_manual_choice") === "true";
  const saved = localStorage.getItem(STORAGE_KEY) as Currency | null;
  if (isManual && (saved === "GHS" || saved === "NGN")) {
    cachedCurrency = saved;
    return saved;
  }

  // Fast IP Geolocation lookup
  const country = await detectCountryCode();
  const detected: Currency = country === "NG" ? "NGN" : "GHS";
  cachedCurrency = detected;
  try {
    localStorage.setItem(STORAGE_KEY, detected);
  } catch {}
  return detected;
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
      const isManual = localStorage.getItem("a1_currency_manual_choice") === "true";
      const saved = localStorage.getItem(STORAGE_KEY) as Currency | null;
      if (isManual && (saved === "GHS" || saved === "NGN")) return saved;
    }
    return cachedCurrency || "GHS";
  });

  const [rate, setRate] = useState<number>(() => cachedRate);
  const [isDetecting, setIsDetecting] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    // Detect currency if user hasn't explicitly forced a manual override
    const isManual = typeof window !== "undefined" && localStorage.getItem("a1_currency_manual_choice") === "true";
    if (!isManual) {
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
      localStorage.setItem("a1_currency_manual_choice", "true");
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
