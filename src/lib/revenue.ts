/**
 * src/lib/revenue.ts
 * Unified revenue and transaction calculation engine for A1-TipsDeck.
 * Ensures 100% consistency between Dashboard Overview (/admin) and Payments Control (/admin/payments).
 */

export interface RevenueCalculationParams {
  manualPayments: any[];
  userTickets: any[];
  subscriptions: any[];
  vipPackages: any[];
  subscriptionPlans: any[];
}

export interface RevenueBreakdown {
  totalRevenue: number;
  totalRevenueNGN: number;
  vipRevenue: number;
  subsRevenue: number;
  totalApprovedTransactions: number;
  approvedVipTicketsCount: number;
  activeSubscriptionsCount: number;
  pendingTransactionsCount: number;
  pendingVipCount: number;
  pendingSubsCount: number;
  getPaymentAmount: (payment: any) => number;
  getTicketAmount: (ticket: any) => number;
  getSubscriptionAmount: (sub: any) => number;
  getSubEffectiveStatus: (sub: any) => "active" | "pending" | "cancelled" | "rejected" | "expired";
}

/**
 * Calculates unified platform revenue, handling fallbacks, avoiding double-counting,
 * and maintaining exact parity between all administrative routes.
 */
export function calculatePlatformRevenue({
  manualPayments = [],
  userTickets = [],
  subscriptions = [],
  vipPackages = [],
  subscriptionPlans = [],
}: RevenueCalculationParams): RevenueBreakdown {
  // Helper to extract amount for a manual payment row
  const getPaymentAmount = (payment: any): number => {
    if (!payment) return 0;
    if (payment.package_id === "recovery" || payment.reference_code?.startsWith("RECOVERY-")) {
      return 0; // Recovery is a free replacement
    }
    const raw = Number(payment.amount);
    if (!isNaN(raw) && raw > 0) return raw;

    // Fallback: look up package price
    const pkg = vipPackages.find((p: any) => p.id === payment.package_id);
    if (pkg && !isNaN(Number(pkg.price)) && Number(pkg.price) > 0) {
      return Number(pkg.price);
    }

    // Fallback: look up subscription plan price
    const cleanSubId = (payment.package_id || "").replace("sub_", "");
    const plan = subscriptionPlans.find(
      (pl: any) => pl.id === payment.package_id || pl.id === `sub_${cleanSubId}` || pl.id === cleanSubId
    );
    if (plan && !isNaN(Number(plan.price)) && Number(plan.price) > 0) {
      return Number(plan.price);
    }

    return 0;
  };

  // Helper to extract amount for a user_tickets row
  const getTicketAmount = (ticket: any): number => {
    if (!ticket) return 0;
    if (ticket.package_id === "recovery" || ticket.payment_ref?.startsWith("RECOVERY-")) {
      return 0; // Free replacement
    }
    if (ticket.payment_ref?.startsWith("test_ref_") || ticket.payment_ref?.startsWith("test_")) {
      return 0; // Test tickets
    }
    const raw = Number(ticket.amount_paid);
    if (!isNaN(raw) && raw > 0) return raw;

    const pkg = vipPackages.find((p: any) => p.id === ticket.package_id);
    if (pkg && !isNaN(Number(pkg.price)) && Number(pkg.price) > 0) {
      return Number(pkg.price);
    }

    return 0;
  };

  // Helper to extract amount for a subscription pass row
  const getSubscriptionAmount = (sub: any): number => {
    if (!sub) return 0;
    const raw = Number(sub.amount_paid);
    if (!isNaN(raw) && raw > 0) return raw;

    // Check linked manual payment
    const linkedPayment = manualPayments.find((p: any) =>
      (p.reference_code && sub.payment_ref && p.reference_code === sub.payment_ref) ||
      (p.user_id === sub.user_id && p.package_id?.includes(sub.subscription_type))
    );
    if (linkedPayment && !isNaN(Number(linkedPayment.amount)) && Number(linkedPayment.amount) > 0) {
      return Number(linkedPayment.amount);
    }

    // Check subscription plan price
    const cleanType = (sub.subscription_type || "").replace("sub_", "");
    const plan = subscriptionPlans.find(
      (pl: any) => pl.id === sub.subscription_type || pl.id === `sub_${cleanType}` || pl.id === cleanType
    );
    if (plan && !isNaN(Number(plan.price)) && Number(plan.price) > 0) {
      return Number(plan.price);
    }

    return 0;
  };

  // Helper to determine the effective subscription status across tables
  const getSubEffectiveStatus = (s: any): "active" | "pending" | "cancelled" | "rejected" | "expired" => {
    const lp = manualPayments.find((p: any) =>
      (p.reference_code && s.payment_ref && p.reference_code === s.payment_ref) ||
      (p.user_id === s.user_id && p.package_id?.includes(s.subscription_type))
    );
    if (s.status === "cancelled" || s.status === "rejected" || lp?.status === "rejected") {
      return s.status === "cancelled" ? "cancelled" : "rejected";
    }
    if (s.status === "active" || lp?.status === "approved") {
      if (s.expires_at && new Date(s.expires_at).getTime() < Date.now()) {
        return "expired";
      }
      return "active";
    }
    return (s.status || lp?.status || "pending") as any;
  };

  // 1. Process Approved Manual Payments
  const approvedManual = manualPayments.filter((p: any) => p.status === "approved");
  const manualRefs = new Set(manualPayments.map((p: any) => p.reference_code).filter(Boolean));

  // Approved single VIP package manual payments
  const approvedManualVip = approvedManual.filter(
    (p: any) => !p.package_id?.startsWith("sub_") && p.package_id !== "recovery"
  );
  const approvedManualVipTotal = approvedManualVip.reduce((sum, p) => sum + getPaymentAmount(p), 0);

  // Approved subscription manual payments
  const approvedManualSubs = approvedManual.filter(
    (p: any) => p.package_id?.startsWith("sub_")
  );
  const approvedManualSubsTotal = approvedManualSubs.reduce((sum, p) => sum + getPaymentAmount(p), 0);

  // 2. Process Online Direct Tickets (Paystack / Webhook / Direct)
  // Exclude tickets that originated from manual payments or test / recovery
  const onlineTickets = userTickets.filter((t: any) => {
    if (t.package_id === "recovery" || t.payment_ref?.startsWith("RECOVERY-")) return false;
    if (t.payment_ref?.startsWith("test_ref_") || t.payment_ref?.startsWith("test_")) return false;
    if (t.payment_ref?.startsWith("MOMO-")) return false;
    if (t.payment_ref && manualRefs.has(t.payment_ref)) return false;
    return true;
  });
  const onlineTicketsTotal = onlineTickets.reduce((sum, t) => sum + getTicketAmount(t), 0);

  // 3. Process Online Direct Active Subscriptions (Non-manual)
  const onlineSubs = subscriptions.filter((s: any) => {
    if (getSubEffectiveStatus(s) !== "active") return false;
    if (s.payment_ref && manualRefs.has(s.payment_ref)) return false;
    const hasLinkedManual = manualPayments.some(
      (p: any) => p.user_id === s.user_id && p.package_id?.includes(s.subscription_type)
    );
    if (hasLinkedManual) return false;
    return true;
  });
  const onlineSubsTotal = onlineSubs.reduce((sum, s) => sum + getSubscriptionAmount(s), 0);

  // Totals
  const vipRevenue = approvedManualVipTotal + onlineTicketsTotal;
  const subsRevenue = approvedManualSubsTotal + onlineSubsTotal;
  const totalRevenue = vipRevenue + subsRevenue;
  const totalRevenueNGN = Math.ceil(totalRevenue * 115);

  // Counts
  const approvedVipTicketsCount = approvedManualVip.length + onlineTickets.length;
  const activeSubscriptionsCount = approvedManualSubs.length + onlineSubs.length;
  const totalApprovedTransactions = approvedVipTicketsCount + activeSubscriptionsCount;

  // Pending
  const pendingVipCount = manualPayments.filter(
    (p: any) => p.status === "pending" && !p.package_id?.startsWith("sub_")
  ).length;
  const pendingSubsCount = subscriptions.filter(
    (s: any) => getSubEffectiveStatus(s) === "pending"
  ).length;
  const pendingTransactionsCount = pendingVipCount + pendingSubsCount;

  return {
    totalRevenue,
    totalRevenueNGN,
    vipRevenue,
    subsRevenue,
    totalApprovedTransactions,
    approvedVipTicketsCount,
    activeSubscriptionsCount,
    pendingTransactionsCount,
    pendingVipCount,
    pendingSubsCount,
    getPaymentAmount,
    getTicketAmount,
    getSubscriptionAmount,
    getSubEffectiveStatus,
  };
}
