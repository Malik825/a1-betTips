import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Save, Settings as SettingsIcon, CreditCard, MessageCircle, Share2, ShieldAlert, KeyRound, Repeat, Sparkles, Tag, DollarSign, Layers } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettingsPage,
});

const DEFAULT_SUBSCRIPTION_PLANS = [
  {
    id: "sub_all_access",
    name: "All-Access VIP Master Pass",
    badge: "Most Popular",
    price: 350,
    original_price: 500,
    category: "combo",
    duration_days: 30,
    tagline: "Gives you access to all 5 VIP and VVIP packages every day for a full month.",
    packages_covered: ["VIP 1", "VIP 2", "VVIP 1", "VVIP 2", "SUPREME VVIP 👑"],
    features: [
      "Unlocks all 5 VIP packages every day",
      "VIP 1 & VIP 2 safe banker slips",
      "VVIP 1 & VVIP 2 high odds accumulators",
      "SUPREME VVIP 👑 top predictions",
      "SportyBet booking codes ready to copy & place",
      "Safety Net: Replacement game when slips fail (as-needed cover)",
      "Direct WhatsApp priority support",
      "Valid for 30 full days",
    ],
    is_active: true,
    admin_notes: "",
    sort_order: 1,
  },
  {
    id: "sub_supreme_vvip",
    name: "Supreme VVIP Pass 👑",
    badge: "Big Odds",
    price: 280,
    original_price: 350,
    category: "combo",
    duration_days: 30,
    tagline: "Our biggest odds daily games with maximum winning potential.",
    packages_covered: ["SUPREME VVIP 👑"],
    features: [
      "Daily SUPREME VVIP 👑 top predictions",
      "High odds slips (25.0 to 50.0+ odds)",
      "SportyBet booking codes included daily",
      "Deep match analysis on every game",
      "Safety Net: Replacement game when slips fail (as-needed cover)",
      "Valid for 30 full days",
    ],
    is_active: true,
    admin_notes: "",
    sort_order: 2,
  },
  {
    id: "sub_vvip_combo",
    name: "VVIP Combo Pass",
    badge: "High Odds Combo",
    price: 220,
    original_price: 280,
    category: "combo",
    duration_days: 30,
    tagline: "Covers BOTH VVIP 1 & VVIP 2 — higher odds and accumulator games.",
    packages_covered: ["VVIP 1", "VVIP 2"],
    features: [
      "Daily access to both VVIP 1 and VVIP 2 slips",
      "Odds from 5.0 up to 30.0+",
      "SportyBet booking codes updated daily",
      "Safety Net: Replacement game when slips fail (as-needed cover)",
      "Valid for 30 full days",
    ],
    is_active: true,
    admin_notes: "",
    sort_order: 3,
  },
  {
    id: "sub_vip_combo",
    name: "VIP Combo Pass",
    badge: "Safe & Steady",
    price: 120,
    original_price: 160,
    category: "combo",
    duration_days: 30,
    tagline: "Covers BOTH VIP 1 & VIP 2 — safe banker slips for steady, daily winning.",
    packages_covered: ["VIP 1", "VIP 2"],
    features: [
      "Daily access to both VIP 1 and VIP 2 slips",
      "Safe banker odds (2.0 to 7.0 odds)",
      "SportyBet booking codes ready to bet",
      "Best for members growing their money safely",
      "Safety Net: Replacement game when slips fail (as-needed cover)",
      "Valid for 30 full days",
    ],
    is_active: true,
    admin_notes: "",
    sort_order: 4,
  },
  {
    id: "sub_vip_1",
    name: "VIP 1 Monthly Pass",
    badge: "Daily Bankers",
    price: 70,
    original_price: 90,
    category: "single",
    duration_days: 30,
    tagline: "Safe daily banker games (2.00 – 3.50 odds) engineered for steady wins.",
    packages_covered: ["VIP 1"],
    features: ["Daily VIP 1 banker predictions", "2.00 – 3.50 Odds", "Booking code included", "Valid for 30 days"],
    is_active: true,
    admin_notes: "",
    sort_order: 5,
  },
  {
    id: "sub_vip_2",
    name: "VIP 2 Monthly Pass",
    badge: "Value Multis",
    price: 70,
    original_price: 90,
    category: "single",
    duration_days: 30,
    tagline: "Balanced multi-bets (3.50 – 7.00 odds) across top European leagues.",
    packages_covered: ["VIP 2"],
    features: ["Daily VIP 2 value predictions", "3.50 – 7.00 Odds", "Booking code included", "Valid for 30 days"],
    is_active: true,
    admin_notes: "",
    sort_order: 6,
  },
  {
    id: "sub_vvip_1",
    name: "VVIP 1 Monthly Pass",
    badge: "Premium Picks",
    price: 130,
    original_price: 160,
    category: "single",
    duration_days: 30,
    tagline: "Premium slips (5.00 – 15.00 odds) with higher payouts.",
    packages_covered: ["VVIP 1"],
    features: ["Daily VVIP 1 premium predictions", "5.00 – 15.00 Odds", "Booking code included", "Valid for 30 days"],
    is_active: true,
    admin_notes: "",
    sort_order: 7,
  },
  {
    id: "sub_vvip_2",
    name: "VVIP 2 Monthly Pass",
    badge: "Accumulators",
    price: 130,
    original_price: 160,
    category: "single",
    duration_days: 30,
    tagline: "Big odds accumulator slips (10.00 – 30.00+ odds) for major wins.",
    packages_covered: ["VVIP 2"],
    features: ["Daily VVIP 2 mega accumulator", "10.00 – 30.00+ Odds", "Booking code included", "Valid for 30 days"],
    is_active: true,
    admin_notes: "",
    sort_order: 8,
  },
];

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="admin-card" style={{ padding: "24px" }}>
      <h2 style={{ fontSize: "15px", fontWeight: 600, color: "var(--foreground)", margin: "0 0 20px", display: "flex", alignItems: "center", gap: "8px" }}>
        {icon} {title}
      </h2>
      {children}
    </section>
  );
}

function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [settings, setSettings] = useState({
    maintenanceMode: false,
    siteName: "A1-TipsDeck",
    whatsappNumber: "+233551234567",
    supportEmail: "support@a1-tipsdeck.com",
    paymentGateway: "manual", // "manual" | "paystack" | "kora"
    paystackPublicKey: "",
    koraPublicKey: "",
    momoNumber: "0550000000",
    momoName: "A1 Predictions",
    momoNetwork: "MTN Mobile Money",
    momoInstructions: "Send payment via MoMo to the number above using your Reference Code as the reference/remarks. Once sent, enter your sender phone number and transaction ID below and submit.",
    telegramLink: "",
    twitterLink: "",
  });

  const { data: remoteSettings, isLoading } = useQuery({
    queryKey: ["admin_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("admin_settings").select("*").eq("id", 1).single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    }
  });

  useEffect(() => {
    if (remoteSettings) {
      setSettings({
        maintenanceMode: remoteSettings.maintenance_mode ?? false,
        siteName: remoteSettings.site_name || "",
        whatsappNumber: remoteSettings.whatsapp_number || "",
        supportEmail: remoteSettings.support_email || "",
        paymentGateway: remoteSettings.payment_gateway || "manual",
        paystackPublicKey: remoteSettings.paystack_public_key || "",
        koraPublicKey: remoteSettings.kora_public_key || "",
        momoNumber: remoteSettings.momo_number || "0556224818",
        momoName: remoteSettings.momo_name || "JOHN YEBOAH",
        momoNetwork: remoteSettings.momo_network || "MTN Mobile Money",
        momoInstructions: remoteSettings.momo_instructions || "Send to the MoMo number above. Use your Reference Code as the MoMo remarks/narration. Then fill in your details below and submit.",
        telegramLink: remoteSettings.telegram_link || "",
        twitterLink: remoteSettings.twitter_link || "",
      });
    }
  }, [remoteSettings]);

  // ── Subscription Plans Management ──
  const [plans, setPlans] = useState<any[]>(DEFAULT_SUBSCRIPTION_PLANS);
  const [editingPlanCategory, setEditingPlanCategory] = useState<"all" | "combo" | "single">("all");

  const { data: dbSubscriptionPlans } = useQuery({
    queryKey: ["subscription_plans_admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) {
        console.warn("Could not load subscription_plans:", error);
        return [];
      }
      return data || [];
    },
  });

  useEffect(() => {
    if (dbSubscriptionPlans && dbSubscriptionPlans.length > 0) {
      const merged = DEFAULT_SUBSCRIPTION_PLANS.map((def) => {
        const found = dbSubscriptionPlans.find((p: any) => p.id === def.id);
        return found ? { ...def, ...found } : def;
      });
      const customOnes = dbSubscriptionPlans.filter(
        (p: any) => !DEFAULT_SUBSCRIPTION_PLANS.some((def) => def.id === p.id)
      );
      setPlans([...merged, ...customOnes]);
    }
  }, [dbSubscriptionPlans]);

  const savePlansMutation = useMutation({
    mutationFn: async () => {
      const payload = plans.map((p, idx) => ({
        id: p.id,
        name: p.name,
        badge: p.badge || null,
        price: Number(p.price || 0),
        original_price: p.original_price ? Number(p.original_price) : null,
        duration_days: Number(p.duration_days || 30),
        tagline: p.tagline || "",
        category: p.category || "combo",
        packages_covered: p.packages_covered || [],
        features: p.features || [],
        is_active: p.is_active ?? true,
        sort_order: p.sort_order ?? (idx + 1),
        admin_notes: p.admin_notes || "",
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("subscription_plans")
        .upsert(payload, { onConflict: "id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription_plans"] });
      queryClient.invalidateQueries({ queryKey: ["subscription_plans_admin"] });
      queryClient.invalidateQueries({ queryKey: ["checkout_pkg"] });
      toast.success("Subscription plans & prices updated successfully!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update subscription plans");
    },
  });

  const handlePlanChange = (planId: string, field: string, value: any) => {
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, [field]: value } : p));
  };

  const { user } = useAuth();
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });
  const [pwLoading, setPwLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.newPw !== pwForm.confirm) {
      toast.error("New passwords do not match.");
      return;
    }
    if (pwForm.newPw.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }
    setPwLoading(true);
    // Re-authenticate with current password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user?.email || "",
      password: pwForm.current,
    });
    if (signInError) {
      toast.error("Current password is incorrect.");
      setPwLoading(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: pwForm.newPw });
    setPwLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password updated successfully! Please log in again.");
      await supabase.auth.signOut();
      navigate({ to: "/login" });
      setPwForm({ current: "", newPw: "", confirm: "" });
    }
  };

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("admin_settings").upsert({
        id: 1,
        maintenance_mode: settings.maintenanceMode,
        site_name: settings.siteName,
        whatsapp_number: settings.whatsappNumber,
        support_email: settings.supportEmail,
        payment_gateway: settings.paymentGateway,
        paystack_public_key: settings.paystackPublicKey,
        kora_public_key: settings.koraPublicKey,
        momo_number: settings.momoNumber,
        momo_name: settings.momoName,
        momo_network: settings.momoNetwork,
        momo_instructions: settings.momoInstructions,
        telegram_link: settings.telegramLink,
        twitter_link: settings.twitterLink,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_settings"] });
      toast.success("Settings saved successfully");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  if (isLoading) {
    return <div style={{ padding: "40px", textAlign: "center", color: "var(--muted-foreground)" }}>Loading settings...</div>;
  }

  const field = (label: string, name: string, type = "text", placeholder = "") => (
    <div>
      <label className="admin-label">{label}</label>
      <input
        className="admin-input"
        name={name}
        type={type}
        placeholder={placeholder}
        value={(settings as any)[name]}
        onChange={handleChange}
        style={name === "paystackPublicKey" ? { fontFamily: "monospace" } : undefined}
      />
    </div>
  );

  return (
    <div style={{ maxWidth: "820px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--foreground)", margin: 0 }}>System Settings</h1>
          <p style={{ color: "var(--muted-foreground)", margin: "4px 0 0", fontSize: "14px" }}>Configure global application preferences</p>
        </div>
        <button
          onClick={() => saveSettingsMutation.mutate()}
          disabled={saveSettingsMutation.isPending}
          className="admin-btn-green"
        >
          <Save size={15} /> {saveSettingsMutation.isPending ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

        {/* General */}
        <SectionCard icon={<SettingsIcon size={17} />} title="General Setup">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", alignItems: "start" }}>
            {field("Site Name", "siteName", "text", "e.g. A1TIPS")}
            <div style={{ paddingTop: "4px" }}>
              <label className="admin-label">Maintenance Mode</label>
              <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  name="maintenanceMode"
                  checked={settings.maintenanceMode}
                  onChange={handleChange}
                  style={{ width: "18px", height: "18px", accentColor: "#ef4444", cursor: "pointer" }}
                />
                <div>
                  <div style={{
                    fontSize: "14px", fontWeight: 600,
                    color: settings.maintenanceMode ? "#ef4444" : "var(--foreground)",
                    display: "flex", alignItems: "center", gap: "6px",
                  }}>
                    <ShieldAlert size={15} />
                    {settings.maintenanceMode ? "Active - site locked" : "Off"}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--muted-foreground)", marginTop: "2px" }}>
                    Blocks access for non-admin users
                  </div>
                </div>
              </label>
            </div>
          </div>
        </SectionCard>

        {/* Payment Gateways & MoMo */}
        <SectionCard icon={<CreditCard size={17} />} title="Payment Methods & Gateway Switcher">
          <div style={{ marginBottom: "20px" }}>
            <label className="admin-label" style={{ marginBottom: "10px" }}>
              Active Payment Method for Customers
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
              
              {/* Option 1: Manual MoMo (Active / Default) */}
              <div 
                onClick={() => setSettings(s => ({ ...s, paymentGateway: "manual" }))}
                style={{
                  padding: "16px",
                  borderRadius: "10px",
                  border: settings.paymentGateway === "manual" ? "2px solid #22c55e" : "1px solid var(--border)",
                  background: settings.paymentGateway === "manual" ? "rgba(34, 197, 94, 0.08)" : "var(--card)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--foreground)" }}>
                    Manual MoMo
                  </span>
                  <span style={{ 
                    width: 14, height: 14, borderRadius: "50%", 
                    border: settings.paymentGateway === "manual" ? "4px solid #22c55e" : "1px solid var(--border)",
                    background: "transparent",
                  }} />
                </div>
                <p style={{ fontSize: "12px", color: "var(--muted-foreground)", margin: 0, lineHeight: 1.4 }}>
                  Direct Mobile Money transfer (MTN/Telecel/AT). <strong>No payment gateway required.</strong> Manual verification in admin.
                </p>
              </div>

              {/* Option 2: Paystack */}
              <div 
                onClick={() => setSettings(s => ({ ...s, paymentGateway: "paystack" }))}
                style={{
                  padding: "16px",
                  borderRadius: "10px",
                  border: settings.paymentGateway === "paystack" ? "2px solid #22c55e" : "1px solid var(--border)",
                  background: settings.paymentGateway === "paystack" ? "rgba(34, 197, 94, 0.08)" : "var(--card)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--foreground)" }}>
                    Paystack
                  </span>
                  <span style={{ 
                    width: 14, height: 14, borderRadius: "50%", 
                    border: settings.paymentGateway === "paystack" ? "4px solid #22c55e" : "1px solid var(--border)",
                    background: "transparent",
                  }} />
                </div>
                <p style={{ fontSize: "12px", color: "var(--muted-foreground)", margin: 0, lineHeight: 1.4 }}>
                  Automated card & MoMo popup. Requires Paystack gaming compliance approval.
                </p>
              </div>

              {/* Option 3: Kora Pay */}
              <div 
                onClick={() => setSettings(s => ({ ...s, paymentGateway: "kora" }))}
                style={{
                  padding: "16px",
                  borderRadius: "10px",
                  border: settings.paymentGateway === "kora" ? "2px solid #22c55e" : "1px solid var(--border)",
                  background: settings.paymentGateway === "kora" ? "rgba(34, 197, 94, 0.08)" : "var(--card)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--foreground)" }}>
                    Kora Pay
                  </span>
                  <span style={{ 
                    width: 14, height: 14, borderRadius: "50%", 
                    border: settings.paymentGateway === "kora" ? "4px solid #22c55e" : "1px solid var(--border)",
                    background: "transparent",
                  }} />
                </div>
                <p style={{ fontSize: "12px", color: "var(--muted-foreground)", margin: 0, lineHeight: 1.4 }}>
                  Alternative gateway without gaming licence barrier. Switch here when Kora setup is ready.
                </p>
              </div>

            </div>
          </div>

          {/* Conditional Gateway Details */}
          {settings.paymentGateway === "manual" && (
            <div style={{ padding: "16px", background: "var(--secondary)", borderRadius: "10px", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--foreground)" }}>
                MoMo Account Details (Shown to Customers on Checkout)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                {field("MoMo Number", "momoNumber", "tel", "0556224818")}
                {field("Account Name", "momoName", "text", "JOHN YEBOAH")}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                {field("Network", "momoNetwork", "text", "MTN Mobile Money")}
                {field("Payment Instructions", "momoInstructions", "text", "Include your Reference Code as the MoMo remarks...")}
              </div>
            </div>
          )}

          {settings.paymentGateway === "paystack" && (
            <div style={{ padding: "16px", background: "var(--secondary)", borderRadius: "10px", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--foreground)", marginBottom: "12px" }}>
                Paystack Gateway Configuration
              </div>
              {field("Paystack Public Key", "paystackPublicKey", "text", "pk_live_... or pk_test_...")}
            </div>
          )}

          {settings.paymentGateway === "kora" && (
            <div style={{ padding: "16px", background: "var(--secondary)", borderRadius: "10px", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--foreground)", marginBottom: "12px" }}>
                Kora Pay Gateway Configuration
              </div>
              {field("Kora Public Key", "koraPublicKey", "text", "pk_live_... or pk_test_...")}
              <p style={{ fontSize: "12px", color: "var(--muted-foreground)", marginTop: "8px" }}>
                Once your Kora account is approved, add your public key here to activate Kora checkout.
              </p>
            </div>
          )}
        </SectionCard>

        {/* VIP Subscription Plans & Pricing Control */}
        <SectionCard icon={<Repeat size={17} />} title="VIP Subscription Plans & Pricing (Negotiation & Discounts)">
          <div style={{ marginBottom: "16px" }}>
            <div style={{
              background: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              padding: "14px 16px",
              borderRadius: "10px",
              marginBottom: "16px",
              fontSize: "12px",
              color: "var(--foreground)",
              lineHeight: 1.5,
            }}>
              <strong style={{ color: "#10b981" }}>💡 Admin Pricing & Negotiation Leverage:</strong>
              <p style={{ margin: "4px 0 0", color: "var(--muted-foreground)" }}>
                Edit the live monthly prices here. The <strong>Standard Price (Before Discount)</strong> is shown crossed-out on the website (e.g. <span style={{ textDecoration: "line-through" }}>GHS 500</span> GHS 350) to highlight the active discount. Use <strong>Admin Notes</strong> to track custom negotiated deals (e.g. for VIP groups or WhatsApp customers).
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  onClick={() => setEditingPlanCategory("all")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    background: editingPlanCategory === "all" ? "var(--foreground)" : "var(--secondary)",
                    color: editingPlanCategory === "all" ? "var(--background)" : "var(--muted-foreground)",
                  }}
                >
                  All Plans ({plans.length})
                </button>
                <button
                  type="button"
                  onClick={() => setEditingPlanCategory("combo")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    background: editingPlanCategory === "combo" ? "var(--foreground)" : "var(--secondary)",
                    color: editingPlanCategory === "combo" ? "var(--background)" : "var(--muted-foreground)",
                  }}
                >
                  Tier Combos
                </button>
                <button
                  type="button"
                  onClick={() => setEditingPlanCategory("single")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    background: editingPlanCategory === "single" ? "var(--foreground)" : "var(--secondary)",
                    color: editingPlanCategory === "single" ? "var(--background)" : "var(--muted-foreground)",
                  }}
                >
                  Single Passes
                </button>
              </div>

              <button
                type="button"
                onClick={() => savePlansMutation.mutate()}
                disabled={savePlansMutation.isPending}
                className="admin-btn-green"
                style={{ fontSize: "12px", padding: "8px 16px" }}
              >
                <Save size={14} /> {savePlansMutation.isPending ? "Saving Plans..." : "Save Plans & Prices"}
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {plans
                .filter(p => editingPlanCategory === "all" || p.category === editingPlanCategory)
                .map((plan) => (
                  <div
                    key={plan.id}
                    style={{
                      padding: "16px",
                      borderRadius: "10px",
                      border: "1px solid var(--border)",
                      background: "var(--secondary)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--foreground)" }}>
                          {plan.name}
                        </span>
                        <span style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "12px",
                          background: plan.category === "combo" ? "rgba(16, 185, 129, 0.15)" : "rgba(59, 130, 246, 0.15)",
                          color: plan.category === "combo" ? "#10b981" : "#3b82f6",
                          textTransform: "uppercase",
                        }}>
                          {plan.category === "combo" ? "Tier Combo" : "Single Package"}
                        </span>
                      </div>

                      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "12px", color: "var(--foreground)" }}>
                        <input
                          type="checkbox"
                          checked={plan.is_active ?? true}
                          onChange={(e) => handlePlanChange(plan.id, "is_active", e.target.checked)}
                          style={{ width: "16px", height: "16px", accentColor: "#10b981", cursor: "pointer" }}
                        />
                        <span>Active on site</span>
                      </label>
                    </div>

                    <p style={{ margin: 0, fontSize: "11px", color: "var(--muted-foreground)" }}>
                      {plan.tagline}
                    </p>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
                      <div>
                        <label className="admin-label" style={{ fontSize: "11px" }}>
                          Selling Price (GHS)
                        </label>
                        <input
                          className="admin-input"
                          type="number"
                          step="1"
                          value={plan.price}
                          onChange={(e) => handlePlanChange(plan.id, "price", Number(e.target.value))}
                          style={{ fontWeight: 700, color: "#10b981" }}
                        />
                      </div>

                      <div>
                        <label className="admin-label" style={{ fontSize: "11px" }}>
                          Standard Price / Before Discount (GHS)
                        </label>
                        <input
                          className="admin-input"
                          type="number"
                          step="1"
                          placeholder="e.g. 500 (optional)"
                          value={plan.original_price ?? ""}
                          onChange={(e) => handlePlanChange(plan.id, "original_price", e.target.value ? Number(e.target.value) : null)}
                        />
                      </div>

                      <div>
                        <label className="admin-label" style={{ fontSize: "11px" }}>
                          Badge Tag
                        </label>
                        <input
                          className="admin-input"
                          type="text"
                          placeholder="e.g. Most Popular, 30% OFF"
                          value={plan.badge ?? ""}
                          onChange={(e) => handlePlanChange(plan.id, "badge", e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="admin-label" style={{ fontSize: "11px" }}>
                          Admin Notes (Private Negotiation Log)
                        </label>
                        <input
                          className="admin-input"
                          type="text"
                          placeholder="e.g. Negotiated 250 for WhatsApp VIPs"
                          value={plan.admin_notes ?? ""}
                          onChange={(e) => handlePlanChange(plan.id, "admin_notes", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => savePlansMutation.mutate()}
                disabled={savePlansMutation.isPending}
                className="admin-btn-green"
              >
                <Save size={15} /> {savePlansMutation.isPending ? "Saving Changes..." : "Save All Subscription Plans"}
              </button>
            </div>
          </div>
        </SectionCard>

        {/* Support */}
        <SectionCard icon={<MessageCircle size={17} />} title="Support Contacts">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            {field("WhatsApp Number", "whatsappNumber", "tel", "+233550000000")}
            {field("Support Email", "supportEmail", "email", "support@a1-tipsdeck.com")}
          </div>
        </SectionCard>

        {/* Password */}
        <SectionCard icon={<KeyRound size={17} />} title="Change Admin Password">
          <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label className="admin-label">Current Password</label>
              <input
                className="admin-input"
                type="password"
                placeholder="Enter current password"
                value={pwForm.current}
                onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))}
                required
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label className="admin-label">New Password</label>
                <input
                  className="admin-input"
                  type="password"
                  placeholder="Min. 6 characters"
                  value={pwForm.newPw}
                  onChange={e => setPwForm(p => ({ ...p, newPw: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="admin-label">Confirm New Password</label>
                <input
                  className="admin-input"
                  type="password"
                  placeholder="Repeat new password"
                  value={pwForm.confirm}
                  onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div>
              <button
                type="submit"
                disabled={pwLoading}
                className="admin-btn-green"
                style={{ marginTop: "4px" }}
              >
                <KeyRound size={15} /> {pwLoading ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        </SectionCard>

      {/* Social */}
        <SectionCard icon={<Share2 size={17} />} title="Social Links">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            {field("Telegram Channel", "telegramLink", "url", "https://t.me/...")}
            {field("Twitter (X) URL", "twitterLink", "url", "https://twitter.com/...")}
          </div>
        </SectionCard>

      </div>
    </div>
  );
}


