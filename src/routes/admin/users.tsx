import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, UserCheck, UserX, Shield, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin_users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, email, status, is_vip, role, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string, newStatus: string }) => {
      const { error } = await supabase.from("profiles").update({ status: newStatus }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
      toast.success("User status updated");
    },
    onError: (err: any) => toast.error(err.message || "Failed to update user status")
  });

  const toggleVipMutation = useMutation({
    mutationFn: async ({ id, isVip }: { id: string, isVip: boolean }) => {
      const { error } = await supabase.from("profiles").update({ is_vip: isVip }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
      toast.success("VIP status updated");
    },
    onError: (err: any) => toast.error(err.message || "Failed to update VIP status")
  });

  const filteredUsers = users.filter((u) =>
    (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.username || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Users Management</h1>
          <p style={{ color: "var(--muted-foreground)", margin: "4px 0 0", fontSize: "14px" }}>Manage your platform users and their access</p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)" }} />
            <input
              className="admin-input"
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: "36px", width: "240px" }}
            />
          </div>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["admin_users"] })}
            className="admin-btn-ghost"
            style={{ padding: "10px" }}
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="admin-card">
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Status</th>
                <th>VIP Access</th>
                <th>Joined</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--muted-foreground)", padding: "32px" }}>Loading users...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--muted-foreground)", padding: "32px" }}>No users found.</td></tr>
              ) : filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td data-label="User">
                    <div style={{ fontWeight: 600, color: "var(--foreground)" }}>{user.username || "Unknown"}</div>
                    <div style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>{user.email}</div>
                  </td>
                  <td data-label="Status">
                    <span className="admin-badge" style={{
                      background: user.status === "active" ? "#dcfce7" : "#fee2e2",
                      color: user.status === "active" ? "#166534" : "#991b1b"
                    }}>
                      {user.status || "active"}
                    </span>
                  </td>
                  <td data-label="VIP Access">
                    <button
                      onClick={() => toggleVipMutation.mutate({ id: user.id, isVip: !user.is_vip })}
                      style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
                    >
                      {user.is_vip ? (
                        <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#8b5cf6", fontSize: "13px", fontWeight: 600 }}>
                          <Shield size={14} /> Active
                        </span>
                      ) : (
                        <span style={{ color: "var(--muted-foreground)", fontSize: "13px" }}>None</span>
                      )}
                    </button>
                  </td>
                  <td data-label="Joined" style={{ color: "var(--muted-foreground)" }}>
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td data-label="Actions" style={{ textAlign: "right" }}>
                    <button
                      onClick={() => toggleStatusMutation.mutate({ id: user.id, newStatus: user.status === "active" ? "banned" : "active" })}
                      disabled={toggleStatusMutation.isPending}
                      style={{
                        background: "transparent", border: "none",
                        cursor: toggleStatusMutation.isPending ? "not-allowed" : "pointer",
                        color: user.status === "active" ? "#ef4444" : "#10b981",
                        display: "inline-flex", alignItems: "center", gap: 6,
                        fontSize: "13px", fontWeight: 600, fontFamily: "inherit",
                        opacity: toggleStatusMutation.isPending ? 0.5 : 1
                      }}
                    >
                      {user.status === "active" ? <><UserX size={15} /> Ban</> : <><UserCheck size={15} /> Unban</>}
                    </button>
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
