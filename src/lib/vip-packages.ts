import { useEffect, useState } from "react";
import type { VipPackageId } from "./vip-status";

export type MatchStatus = "pending" | "won" | "lost";

export type VipMatch = {
  id: string;
  match: string;
  tip: string;
  status: MatchStatus;
};

export type VipPackage = {
  id: VipPackageId;
  title: string;
  price: string;
  matches: VipMatch[];
  /** ISO-8601 string: the date/time after which the package auto-expires. Absent = never expires. */
  expiresAt?: string;
};

const m = (id: string, match: string, tip: string, status: MatchStatus = "pending"): VipMatch => ({
  id,
  match,
  tip,
  status,
});

// No hardcoded packages — all data comes from Supabase
export const defaultVipPackages: VipPackage[] = [];

const STORAGE_KEY = "a1tipsdeck.vip-packages";
const OLD_STORAGE_KEY = "a1groupinsights.vip-packages";
const EVENT = "a1tipsdeck:vip-packages";

export function readVipPackages(): VipPackage[] {
  if (typeof window === "undefined") return defaultVipPackages;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) || window.localStorage.getItem(OLD_STORAGE_KEY);
    if (!raw) return defaultVipPackages;
    const parsed = JSON.parse(raw) as VipPackage[];
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultVipPackages;
    // Filter out packages whose expiry date has passed
    const now = new Date();
    return parsed.filter((pkg) => !pkg.expiresAt || new Date(pkg.expiresAt) > now);
  } catch {
    return defaultVipPackages;
  }
}

export function saveVipPackages(packages: VipPackage[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(packages));
  window.dispatchEvent(new Event(EVENT));
}

export function updateVipMatch(
  packageId: VipPackageId,
  matchId: string,
  patch: Partial<Pick<VipMatch, "tip" | "status">>,
) {
  const packages = readVipPackages().map((pkg) =>
    pkg.id !== packageId
      ? pkg
      : {
          ...pkg,
          matches: pkg.matches.map((match) => (match.id === matchId ? { ...match, ...patch } : match)),
        },
  );
  saveVipPackages(packages);
}

export function useVipPackages(): VipPackage[] {
  const [packages, setPackages] = useState<VipPackage[]>(defaultVipPackages);

  useEffect(() => {
    const sync = () => setPackages(readVipPackages());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return packages;
}
