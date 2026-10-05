import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Save, Settings as SettingsIcon, CreditCard, MessageCircle, Share2, ShieldAlert, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettingsPage,
});

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
        momoNumber: remoteSettings.momo_number || "0550000000",
        momoName: remoteSettings.momo_name || "A1 Predictions",
        momoNetwork: remoteSettings.momo_network || "MTN Mobile Money",
        momoInstructions: remoteSettings.momo_instructions || "Send payment via MoMo to the number above using your Reference Code as the reference/remarks. Once sent, enter your sender phone number and transaction ID below and submit.",
        telegramLink: remoteSettings.telegram_link || "",
        twitterLink: remoteSettings.twitter_link || "",
      });
    }
  }, [remoteSettings]);

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
                  Direct Mobile Money transfer. <strong>No gaming commission licence required.</strong> Instant verification in admin.
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
                Mobile Money Account Details (Shown to Customers on Checkout)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                {field("MoMo Number", "momoNumber", "tel", "0550000000")}
                {field("Account Name", "momoName", "text", "A1 Predictions")}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                {field("Network Name", "momoNetwork", "text", "MTN Mobile Money")}
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


