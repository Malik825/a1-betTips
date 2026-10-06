import { createFileRoute } from "@tanstack/react-router";
import { Users, CreditCard, Gamepad2, Crown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboardIndex,
});

function StatCard({ label, value, subValue, icon: Icon, color }: { label: string; value: string; subValue?: React.ReactNode; icon: any; color: string }) {
  return (
    <div style={{
      background: "var(--card)",
      border: "1px solid var(--border)",
      padding: "20px 22px",
      borderRadius: "12px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "16px",
    }}>
      <div>
        <p style={{ color: "var(--muted-foreground)", fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", margin: 0 }}>{label}</p>
        <h2 style={{ fontSize: "24px", fontWeight: 700, color: "var(--foreground)", margin: "6px 0 0" }}>{value}</h2>
        {subValue && (
          <div style={{ marginTop: "4px" }}>
            {subValue}
          </div>
        )}
      </div>
      <div style={{
        width: "46px", height: "46px", borderRadius: "50%",
        background: `${color}18`,
        color,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <Icon size={22} />
      </div>
    </div>
  );
}

function AdminDashboardIndex() {
  const { data: vipPackages = [] } = useQuery({
    queryKey: ["admin_vip_packages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("secure_vip_packages").select("*");
      if (error) throw error;
      return data || [];
    }
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["admin_users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, username");
      if (error) throw error;
      return data || [];
    }
  });

  const { data: userTickets = [] } = useQuery({
    queryKey: ["all_user_tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_tickets")
        .select("*")
        .order("purchased_at", { ascending: false });
      if (error) {
        console.error("Error fetching user_tickets:", error);
        return [];
      }
      return data || [];
    }
  });

  const { data: vipSelections = [] } = useQuery({
    queryKey: ["all_vip_package_fixtures"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vip_package_fixtures").select("*");
      if (error) throw error;
      return data || [];
    }
  });

  const totalUsers = allUsers.length;

  // Exclude test-mode purchases from revenue and counts if prefixed with test_ref_
  const realTickets = (userTickets as any[]).filter(
    (t) => !t.payment_ref?.startsWith("test_ref_")
  );

  const totalSales = realTickets.reduce((sum, ticket) => {
    // Use amount_paid stored at purchase time (accurate even if package price changes later)
    const paid = Number((ticket as any).amount_paid ?? 0);
    if (paid > 0) return sum + paid;
    // Fallback for old tickets that predate the amount_paid column
    const pkg = (vipPackages as any[]).find((p) => p.id === ticket.package_id);
    return sum + (pkg ? Number(pkg.price || 0) : 0);
  }, 0);
  const activeGamesCount = (vipSelections as any[]).filter((s) => s.result_status === "pending").length;
  const totalSubs = realTickets.length;

  const totalSalesGHS = totalSales;
  const totalSalesNGN = Math.ceil(totalSalesGHS * 115);

  const stats = [
    { label: "Registered Users", value: totalUsers.toString(), icon: Users, color: "#3b82f6" },
    {
      label: "Total Revenue",
      value: `GH₵ ${totalSalesGHS.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      subValue: (
        <span style={{ color: "#10b981", fontSize: "13px", fontWeight: 700 }}>
          ≈ ₦{totalSalesNGN.toLocaleString()} NGN
        </span>
      ),
      icon: CreditCard,
      color: "#10b981",
    },
    { label: "Active Predictions", value: activeGamesCount.toString(), icon: Gamepad2, color: "#f59e0b" },
    { label: "Total VIP Subs", value: totalSubs.toString(), icon: Crown, color: "#8b5cf6" },
  ];

  const recentActivities = (userTickets as any[]).slice(0, 10).map((ticket) => {
    const pkg = (vipPackages as any[]).find((p) => p.id === ticket.package_id);
    const profile = (allUsers as any[]).find((u) => u.id === ticket.user_id);
    const userLabel = profile?.email || profile?.username || `user_${ticket.user_id.substring(0, 8)}`;
    const isTest = ticket.payment_ref?.startsWith("test_ref_");
    const amountGHS = Number(ticket.amount_paid || pkg?.price || 0);
    const amountNGN = Math.ceil(amountGHS * 115);
    return {
      id: ticket.id,
      user: userLabel,
      action: `Purchased ${pkg?.name || "Package"}`,
      amountGHS,
      amountNGN,
      date: new Date(ticket.purchased_at).toLocaleString("en-GB", {
        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
      }),
      isTest,
    };
  });

  return (
    <div>
      <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--foreground)", marginBottom: "28px" }}>
        Dashboard Overview
      </h1>

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "18px", marginBottom: "36px" }}>
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* Recent Purchases */}
      <div className="admin-card">
        <div className="admin-card-header">
          <h2 style={{ fontSize: "15px", fontWeight: 600, color: "var(--foreground)", margin: 0 }}>Recent Purchases</h2>
          <span style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>Last 10 transactions</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Package</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentActivities.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "var(--muted-foreground)", padding: "32px" }}>
                    No recent purchases found.
                  </td>
                </tr>
              ) : recentActivities.map((activity: any) => (
                <tr key={activity.id}>
                  <td style={{ fontWeight: 600 }}>{activity.user}</td>
                  <td style={{ color: "var(--muted-foreground)" }}>{activity.action}</td>
                  <td>
                    <div style={{ fontWeight: 700, color: "var(--foreground)" }}>GH₵ {activity.amountGHS.toFixed(2)}</div>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "#10b981" }}>≈ ₦{activity.amountNGN.toLocaleString()}</div>
                  </td>
                  <td style={{ color: "var(--muted-foreground)" }}>{activity.date}</td>
                  <td>
                    {activity.isTest ? (
                      <span className="admin-badge" style={{ background: "#fef3c7", color: "#92400e" }}>Test</span>
                    ) : (
                      <span className="admin-badge" style={{ background: "#dcfce7", color: "#166534" }}>Success</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
