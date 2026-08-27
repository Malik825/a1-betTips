import { useState } from "react";
import { useVipPackages, type MatchStatus } from "@/lib/vip-packages";
import { useVipStatus } from "@/lib/vip-status";
import { useContactLinks } from "@/lib/contact-links";

const filters = ["All", "Pending", "Won", "Lost"] as const;
type Filter = (typeof filters)[number];

const statusColors: Record<MatchStatus, { bg: string; fg: string; label: string }> = {
  pending: { bg: "#fef3c7", fg: "#92400e", label: "Pending" },
  won: { bg: "#dcfce7", fg: "#166534", label: "Won" },
  lost: { bg: "#fee2e2", fg: "#991b1b", label: "Lost" },
};

export function VipPackagesSection() {
  const [filter, setFilter] = useState<Filter>("All");
  const packages = useVipPackages();
  const vipStatus = useVipStatus();
  const contactLinks = useContactLinks();

  return (
    <section style={{ background: "#f8f9fa", padding: "24px 20px 80px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: "40px 24px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.02), 0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111827", marginBottom: 8 }}>
              Today's Featured Matches
            </h2>
            <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
              Premium predictions with high confidence ratings
            </p>
          </div>

          {/* Filters */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
            <div style={{ display: "inline-flex", background: "#e9ecef", borderRadius: 50, padding: 4, gap: 4 }}>
              {filters.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: "8px 20px",
                    borderRadius: 50,
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 13,
                    background: filter === f ? "#22c55e" : "transparent",
                    color: filter === f ? "#fff" : "#444",
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
            {packages.map((pkg) => {
              const isAvailable = vipStatus[pkg.id] === "available";
              const matches =
                filter === "All"
                  ? pkg.matches
                  : pkg.matches.filter((m) => m.status === (filter.toLowerCase() as MatchStatus));

              return (
                <div
                  key={pkg.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    padding: "28px 24px",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <h3
                    style={{
                      fontSize: "1.25rem",
                      fontWeight: 700,
                      color: "#111827",
                      textAlign: "center",
                      marginBottom: 24,
                    }}
                  >
                    {pkg.title}
                  </h3>

                  <ul style={{ listStyle: "none", padding: 0, margin: 0, flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
                    {matches.map((m) => {
                      const c = statusColors[m.status];
                      return (
                        <li key={m.id}>
                          <div style={{ fontSize: 13, color: "#111827", fontWeight: 600 }}>{m.match}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                            <span style={{ fontSize: 12, color: "#6b7280" }}>{m.tip}</span>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: 50,
                                background: c.bg,
                                color: c.fg,
                              }}
                            >
                              {c.label}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                    {matches.length === 0 && (
                      <li style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "16px 0" }}>
                        No {filter.toLowerCase()} matches.
                      </li>
                    )}
                  </ul>

                  <div style={{ marginTop: 32 }}>
                    {isAvailable ? (
                      <a
                        href={contactLinks.vip}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "block",
                          padding: 12,
                          background: "#22c55e",
                          color: "#fff",
                          textAlign: "center",
                          fontWeight: 700,
                          borderRadius: 6,
                          textDecoration: "none",
                        }}
                      >
                        Buy Now {pkg.price}
                      </a>
                    ) : (
                      <button
                        disabled
                        style={{
                          display: "block",
                          width: "100%",
                          padding: 12,
                          background: "#ef4444",
                          color: "#fff",
                          fontWeight: 700,
                          borderRadius: 6,
                          border: "none",
                          cursor: "not-allowed",
                        }}
                      >
                        SOLD OUT
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
