import { Link } from "@tanstack/react-router";
import { Send } from "lucide-react";
import { Logo } from "@/components/logo";

export function SiteFooter() {
  return (
    <footer style={{ background: "var(--background)", color: "var(--foreground)" }}>
      {/* Main footer grid */}
      <div className="w-[95%] sm:w-[92%] max-w-[1100px] mx-auto py-14 px-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr] gap-10 lg:gap-12">

        {/* Brand column */}
        <div>
          <Link to="/" aria-label="A1-TipsDeck home" className="inline-block">
            <Logo className="h-10" />
          </Link>
          <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.7, color: "var(--muted-foreground)", maxWidth: 280 }}>
            Your #1 partner for premium sports analytics. Trusted by thousands of sports enthusiasts across Africa for expert insights and data-driven results.
          </p>
          {/* Community link */}
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <a
              href="https://t.me/+S6zQhRKDOV02YjJk"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Telegram"
              className="flex items-center gap-1.5 bg-[#229ED9]/10 hover:bg-[#229ED9]/20 border border-[#229ED9]/30 text-[#229ED9] font-bold text-xs px-3 py-1.5 rounded-full transition-colors"
            >
              <Send size={13} />
              Join our Telegram
            </a>
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h3
            style={{
              color: "var(--foreground)",
              fontWeight: 700,
              fontSize: 15,
              marginBottom: 16,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Quick Links
          </h3>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "Home", to: "/" },
              { label: "Analytics", to: "/predictions" },
              { label: "VIP Access", to: "/vip" },
              { label: "Dashboard", to: "/dashboard" },
              { label: "About Us", to: "/about" },
              { label: "Contact Us", to: "/contact" },
            ].map(({ label, to }) => (
              <li key={label}>
                <Link
                  to={to}
                  style={{ color: "var(--muted-foreground)", fontSize: 14, textDecoration: "none", transition: "color 0.15s" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--primary)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--muted-foreground)")}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Legal */}
        <div>
          <h3
            style={{
              color: "var(--foreground)",
              fontWeight: 700,
              fontSize: 15,
              marginBottom: 16,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Legal
          </h3>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "Terms of Service", to: "/terms" },
              { label: "Privacy Policy", to: "/privacy" },
              { label: "Refund Policy", to: "/refund" },
            ].map((item) => (
              <li key={item.label}>
                <Link
                  to={item.to}
                  style={{ color: "var(--muted-foreground)", fontSize: 14, textDecoration: "none", transition: "color 0.15s" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--primary)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--muted-foreground)")}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <div style={{ marginTop: 24 }}>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
              For support, reach us at:
            </p>
            <a
              href="mailto:support@a1-tipsdeck.com"
              style={{ fontSize: 13, color: "var(--primary)", textDecoration: "none", fontWeight: 600 }}
            >
              support@a1-tipsdeck.com
            </a>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          borderTop: "1px solid var(--border)",
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          maxWidth: 1100,
          margin: "0 auto",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
          © {new Date().getFullYear()} A1-TipsDeck. All rights reserved.
        </span>
        <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
          For Entertainment Purposes Only • 18+
        </span>
      </div>
    </footer>
  );
}


