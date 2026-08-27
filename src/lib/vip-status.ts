import { useEffect, useState } from "react";

export type VipPackageId = "vip1" | "vip2" | "vip3";

export type VipStatus = Record<VipPackageId, "available" | "sold_out">;

const defaultVipStatus: VipStatus = {
  vip1: "sold_out",
  vip2: "sold_out",
  vip3: "sold_out",
};

const STORAGE_KEY = "oddsking.vip-status";
const EVENT = "oddsking:vip-status";

export function readVipStatus(): VipStatus {
  if (typeof window === "undefined") return defaultVipStatus;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultVipStatus;
    return { ...defaultVipStatus, ...(JSON.parse(raw) as Partial<VipStatus>) };
  } catch {
    return defaultVipStatus;
  }
}

export function saveVipStatus(status: VipStatus) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(status));
  window.dispatchEvent(new Event(EVENT));
}

export function updateVipStatus(id: VipPackageId, state: "available" | "sold_out") {
  const current = readVipStatus();
  saveVipStatus({ ...current, [id]: state });
}

export function useVipStatus(): VipStatus {
  const [status, setStatus] = useState<VipStatus>(defaultVipStatus);

  useEffect(() => {
    const sync = () => setStatus(readVipStatus());
    sync(); // init
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return status;
}
