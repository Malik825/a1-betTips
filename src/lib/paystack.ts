import { toast } from "sonner";

export const PAYSTACK_ENABLED = true;

declare global {
  interface Window {
    PaystackPop: any;
  }
}

function loadPaystackScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window.PaystackPop !== "undefined") {
      resolve();
      return;
    }
    const existing = document.querySelector('script[src="https://js.paystack.co/v1/inline.js"]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Script failed")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Script failed"));
    document.head.appendChild(script);
  });
}

export async function paystackPay(
  email: string,
  amount: number,
  packageId: string,
  onSuccess: (reference: string) => void,
  onClose?: () => void
): Promise<boolean> {
  if (!PAYSTACK_ENABLED) {
    toast("Payment coming soon — contact us at support@a1-tipsdeck.com", { icon: "🔒" });
    return false;
  }

  try {
    await loadPaystackScript();
  } catch {
    toast.error("Payment gateway could not be loaded. Please check your connection or disable your adblocker.");
    return false;
  }

  if (typeof window.PaystackPop === "undefined") {
    toast.error("Payment gateway could not be loaded. Please refresh and try again.");
    return false;
  }

  // Allow React to paint the "Opening secure checkout..." loading state
  await new Promise(res => setTimeout(res, 800));

  // PaystackPop.setup() is the correct static method — no 'new' needed
  const handler = window.PaystackPop.setup({
    key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
    email,
    amount: Math.round(amount * 100), // Paystack expects pesewas
    currency: "GHS",
    ref: `pkg_${packageId}_${Date.now()}`,
    callback: (response: any) => {
      onSuccess(response.reference);
    },
    onClose: () => {
      toast("Payment cancelled");
      onClose?.();
    },
  });

  handler.openIframe();
  return true;
}
