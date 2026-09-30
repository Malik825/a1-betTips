import { useEffect, useState } from "react";

export type ContactLinks = {
  whatsapp: string;
  telegram: string;
  vip: string;
};

export const defaultContactLinks: ContactLinks = {
  whatsapp: "",
  telegram: "",
  vip: "",
};

const STORAGE_KEY = "a1tipsdeck.contact-links";
const OLD_STORAGE_KEY = "a1groupinsights.contact-links";
const EVENT = "a1tipsdeck:contact-links";

export function readContactLinks(): ContactLinks {
  if (typeof window === "undefined") return defaultContactLinks;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) || window.localStorage.getItem(OLD_STORAGE_KEY);
    if (!raw) return defaultContactLinks;
    return { ...defaultContactLinks, ...(JSON.parse(raw) as Partial<ContactLinks>) };
  } catch {
    return defaultContactLinks;
  }
}

export function saveContactLinks(links: ContactLinks) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
  window.dispatchEvent(new Event(EVENT));
}

export function useContactLinks(): ContactLinks {
  const [links, setLinks] = useState<ContactLinks>(defaultContactLinks);

  useEffect(() => {
    const sync = () => setLinks(readContactLinks());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return links;
}
