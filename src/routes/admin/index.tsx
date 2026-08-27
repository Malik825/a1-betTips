import { createFileRoute } from "@tanstack/react-router";
import { Users, CreditCard, Gamepad2, Crown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboardIndex,
});

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <div style={{
      background: "var(--card)",
      border: "1px solid var(--border)",
      padding: "22px",
      borderRadius: "12px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "16px",
    }}>
      <div>
        <p style={{ color: "var(--muted-foreground)", fontSize: "13px", fontWeight: 500, margin: 0 }}>{label}</p>
        <h2 style={{ fontSize: "26px", fontWeight: 700, color: "var(--foreground)", margin: "6px 0 0" }}>{value}</h2>
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
    queryKey: ["vip_packages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vip_packages").select("*");
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
      if (error) throw error;
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

  const { data: allUsers = [] } = useQuery({
    queryKey: ["admin_users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id");
      if (error) throw error;
      return data || [];
    }
  });

  const totalUsers = allUsers.length;
  const totalSales = userTickets.reduce((sum, ticket) => {
    const pkg = vipPackages.find((p) => p.id === ticket.package_id);
    return sum + (pkg ? Number(pkg.price || 0) : 0);
  }, 0);
  const activeGamesCount = vipSelections.filter((s) => s.result_status === "pending").length;
  const totalSubs = userTickets.length;

  const stats = [
    { label: "Registered Users", value: totalUsers.toString(), icon: Users, color: "#3b82f6" },
    { label: "Total Sales", value: `GHS ${totalSales.toFixed(2)}`, icon: CreditCard, color: "#10b981" },
    { label: "Active Predictions", value: activeGamesCount.toString(), icon: Gamepad2, color: "#f59e0b" },
    { label: "Total VIP Subs", value: totalSubs.toString(), icon: Crown, color: "#8b5cf6" },
  ];

  const recentActivities = userTickets.slice(0, 10).map((ticket) => {
    const pkg = vipPackages.find((p) => p.id === ticket.package_id);
    return {
      id: ticket.id,
      user: `user_${ticket.user_id.substring(0, 6)}`,
      action: `Purchased ${pkg?.name || "Package"}`,
      date: new Date(ticket.purchased_at).toLocaleString("en-GB", {
        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
      }),
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
                <th>User ID</th>
                <th>Action</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentActivities.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "var(--muted-foreground)", padding: "32px" }}>
                    No recent purchases found.
                  </td>
                </tr>
              ) : recentActivities.map((activity) => (
                <tr key={activity.id}>
                  <td style={{ fontWeight: 600 }}>@{activity.user}</td>
                  <td style={{ color: "var(--muted-foreground)" }}>{activity.action}</td>
                  <td style={{ color: "var(--muted-foreground)" }}>{activity.date}</td>
                  <td>
                    <span className="admin-badge" style={{ background: "#dcfce7", color: "#166534" }}>
                      Success
                    </span>
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
