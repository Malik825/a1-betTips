import { toast } from "sonner";

export const PAYSTACK_ENABLED = true;

// Emails that bypass Paystack entirely for testing purposes.
const TEST_EMAILS = new Set([
  "abdulmaliksuleman75@gmail.com",
  "admin@a1-tipsdeck.com",
]);

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
  onSuccess: (reference: string) => void
) {
  if (!PAYSTACK_ENABLED) {
    toast("Payment coming soon — contact us at support@a1-tipsdeck.com", { icon: "🔒" });
    return;
  }

  // Test/admin emails skip real payment for manual QA
  if (TEST_EMAILS.has(email.toLowerCase())) {
    toast.success("Test mode: payment bypassed for admin account.");
    onSuccess(`test_ref_${packageId}_${Date.now()}`);
    return;
  }

  try {
    await loadPaystackScript();
  } catch {
    toast.error("Payment gateway could not be loaded. Please check your connection or disable your adblocker.");
    return;
  }

  if (typeof window.PaystackPop === "undefined") {
    toast.error("Payment gateway could not be loaded. Please refresh and try again.");
    return;
  }

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
    },
  });

  handler.openIframe();
}
