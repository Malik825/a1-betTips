import { createFileRoute, Link, Outlet, useRouterState, redirect } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { LayoutDashboard, Gamepad2, Users, Bell, MessageSquare, Settings, Sun, Moon, Monitor, Menu, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useTheme } from "@/lib/theme-provider";
import { useState, useEffect } from "react";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const navItems = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Games Control", href: "/admin/games", icon: Gamepad2 },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Notifications", href: "/admin/notifications", icon: Bell },
  { label: "SMS", href: "/admin/sms", icon: MessageSquare },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

function ThemeToggle({ collapsed }: { collapsed: boolean }) {
  const { theme, setTheme } = useTheme();
  const options = [
    { key: "light", icon: Sun, label: "Light" },
    { key: "dark", icon: Moon, label: "Dark" },
    { key: "system", icon: Monitor, label: "System" },
  ] as const;

  if (collapsed) {
    // In collapsed mode show only the active theme icon with a cycle button
    const active = options.find(o => o.key === theme) || options[0];
    const next = options[(options.findIndex(o => o.key === theme) + 1) % options.length];
    return (
      <button
        onClick={() => setTheme(next.key)}
        title={`Theme: ${active.label} (click to cycle)`}
        style={{
          width: 36, height: 36, borderRadius: 9, border: "1px solid var(--border)",
          background: "var(--secondary)", color: "var(--foreground)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", transition: "all 0.15s",
        }}
      >
        <active.icon size={15} />
      </button>
    );
  }

  return (
    <div style={{ display: "flex", gap: "4px", padding: "4px", borderRadius: "10px", background: "var(--secondary)", border: "1px solid var(--border)" }}>
      {options.map(({ key, icon: Icon, label }) => (
        <button
          key={key}
          onClick={() => setTheme(key)}
          title={label}
          style={{
            padding: "8px", borderRadius: "7px", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "0",
            transition: "all 0.15s", flex: 1,
            background: theme === key ? "var(--card)" : "transparent",
            color: theme === key ? "var(--foreground)" : "var(--muted-foreground)",
            boxShadow: theme === key ? "0 1px 3px oklch(0 0 0 / 12%)" : "none",
          }}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  );
}

import { useAuth } from "@/lib/auth-context";
import { useNavigate } from "@tanstack/react-router";

function AdminLayout() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  // Desktop collapsed state (icon-rail mode)
  const [collapsed, setCollapsed] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  // Mobile open state (drawer overlay)
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        navigate({ to: "/login", replace: true });
      } else if (user.app_metadata?.role !== "admin") {
        navigate({ to: "/", replace: true });
      }
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    setIsClient(true);
    try {
      if (localStorage.getItem("admin-sidebar-collapsed") === "true") {
        setCollapsed(true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (isClient) {
      try { localStorage.setItem("admin-sidebar-collapsed", String(collapsed)); } catch {}
    }
  }, [collapsed, isClient]);

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [currentPath]);

  if (isLoading || !user || user.app_metadata?.role !== "admin") {
    return null; // or a loading spinner
  }

  const sidebarWidth = collapsed ? 64 : 200;

  return (
    <div className="admin-layout" style={{ position: "relative" }}>

      {/* ── Mobile overlay backdrop ─────────────────────────── */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 40,
            background: "oklch(0 0 0 / 40%)",
            backdropFilter: "blur(2px)",
            animation: "fadeIn 0.2s ease",
          }}
        />
      )}

      {/* ── Mobile top bar ──────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 16px",
        background: "var(--sidebar)",
        borderBottom: "1px solid var(--border)",
        position: "sticky", top: 0, zIndex: 30,
      }} className="admin-mobile-topbar">
        <button
          onClick={() => setMobileOpen(o => !o)}
          style={{
            border: "none", background: "transparent", cursor: "pointer",
            color: "var(--sidebar-foreground)", padding: 4,
            display: "flex", alignItems: "center",
          }}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <Link to="/" style={{ color: "#22c55e", fontSize: "20px", fontWeight: 800, textDecoration: "none", letterSpacing: "-0.02em" }}>
          A1<span style={{ color: "var(--sidebar-foreground)" }}>TIPS</span>
        </Link>
      </div>

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        className="admin-sidebar"
        style={{
          width: sidebarWidth,
          minWidth: sidebarWidth,
          transition: "width 0.22s ease, min-width 0.22s ease",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Brand + desktop collapse toggle */}
        <div style={{
          padding: collapsed ? "20px 14px" : "20px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          gap: 8, transition: "padding 0.22s ease",
        }}>
          {!collapsed && (
            <Link to="/" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
              <Logo className="h-8" />
            </Link>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            style={{
              border: "1px solid var(--border)", borderRadius: 8,
              background: "var(--secondary)", color: "var(--sidebar-foreground)",
              cursor: "pointer", padding: "5px 7px",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, transition: "all 0.15s",
            }}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: collapsed ? "16px 8px" : "16px 10px", transition: "padding 0.22s ease" }}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
            {navItems.map((item) => {
              const isExact = item.href === "/admin";
              const isActive = isExact ? currentPath === "/admin" : currentPath.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    title={collapsed ? item.label : undefined}
                    style={{
                      display: "flex", alignItems: "center",
                      gap: collapsed ? 0 : "11px",
                      justifyContent: collapsed ? "center" : "flex-start",
                      padding: collapsed ? "10px" : "10px 12px",
                      borderRadius: "9px", textDecoration: "none",
                      fontWeight: 500, fontSize: "14px",
                      transition: "all 0.15s",
                      background: isActive ? "var(--accent)" : "transparent",
                      color: isActive ? "var(--primary)" : "var(--muted-foreground)",
                      fontFamily: "inherit", whiteSpace: "nowrap",
                      overflow: "hidden",
                    }}
                  >
                    <item.icon size={17} style={{ flexShrink: 0 }} />
                    {!collapsed && <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

      </aside>

      {/* ── Mobile drawer (overlaid) ─────────────────────────── */}
      <aside
        style={{
          position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 50,
          width: 220,
          background: "var(--sidebar)",
          color: "var(--sidebar-foreground)",
          borderRight: "1px solid var(--border)",
          display: "flex", flexDirection: "column",
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s ease",
          boxShadow: mobileOpen ? "4px 0 24px oklch(0 0 0 / 18%)" : "none",
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link to="/" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
            <Logo className="h-8" />
          </Link>
          <button onClick={() => setMobileOpen(false)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--sidebar-foreground)", padding: 4, display: "flex" }}>
            <X size={18} />
          </button>
        </div>
        {/* Nav */}
        <nav style={{ flex: 1, padding: "16px 10px", overflowY: "auto" }}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
            {navItems.map((item) => {
              const isExact = item.href === "/admin";
              const isActive = isExact ? currentPath === "/admin" : currentPath.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    style={{
                      display: "flex", alignItems: "center", gap: "11px",
                      padding: "10px 12px", borderRadius: "9px", textDecoration: "none",
                      fontWeight: 500, fontSize: "14px", transition: "all 0.15s",
                      background: isActive ? "var(--accent)" : "transparent",
                      color: isActive ? "var(--primary)" : "var(--muted-foreground)",
                      fontFamily: "inherit",
                    }}
                  >
                    <item.icon size={17} style={{ flexShrink: 0 }} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        {/* Mobile Theme Toggle */}
        <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "center" }}>
          <div style={{ width: "100%" }}>
            <ThemeToggle collapsed={false} />
          </div>
        </div>
      </aside>

      {/* ── Main Content Area ────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh" }}>
        
        {/* Desktop Topbar */}
        <header style={{
          display: "none", // Hidden on mobile, shown via media query in css ideally, but let's just use flex for desktop
          padding: "12px 24px",
          background: "var(--background)",
          borderBottom: "1px solid var(--border)",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "16px",
          zIndex: 20
        }} className="admin-desktop-topbar">
          <Link to="/" style={{
            color: "var(--muted-foreground)", textDecoration: "none", fontSize: "13px",
            display: "flex", alignItems: "center", gap: "6px", fontWeight: 500
          }}>
            ← Back to Site
          </Link>
          <div style={{ width: "1px", height: "16px", background: "var(--border)" }} />
          <div style={{ width: 120 }}>
            <ThemeToggle collapsed={false} />
          </div>
        </header>

        <main className="admin-main" style={{ flex: 1, overflowY: "auto" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

