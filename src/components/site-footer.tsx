import { Link } from "@tanstack/react-router";
import { Facebook, Twitter, Instagram, Send } from "lucide-react";
import logo from "@/assets/logo-horizontal.jpg";

export function SiteFooter() {
  return (
    <footer style={{ background: "var(--background)", color: "var(--foreground)" }}>
      {/* Main footer grid */}
      <div className="w-[95%] sm:w-[92%] max-w-[1100px] mx-auto py-14 px-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr] gap-10 lg:gap-12">

        {/* Brand column */}
        <div>
          <Link to="/" aria-label="A1 PREDICTIONS home">
            <img src={logo} alt="A1 Predictions" className="transition-all" style={{ height: 48, width: "auto", objectFit: "contain", borderRadius: 4 }} />
          </Link>
          <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.7, color: "var(--muted-foreground)", maxWidth: 280 }}>
            Your #1 partner for premium sports predictions. Join thousands of winning bettors who trust A1 Predictions every day.
          </p>
          {/* Social icons */}
          <div style={{ display: "flex", gap: 14, marginTop: 20 }}>
            {[
              { Icon: Facebook, href: "#", label: "Facebook" },
              { Icon: Twitter, href: "#", label: "Twitter" },
              { Icon: Instagram, href: "#", label: "Instagram" },
              { Icon: Send, href: "#", label: "Telegram" },
            ].map(({ Icon, href, label }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                style={{
                  color: "var(--muted-foreground)",
                  transition: "color 0.15s",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--primary)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--muted-foreground)")}
              >
                <Icon size={20} />
              </a>
            ))}
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
              { label: "About Us", to: "/about" },
              { label: "Predictions", to: "/predictions" },
              { label: "VIP Plans", to: "/dashboard" },
              { label: "Settings", to: "/" },
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

        {/* Support */}
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
            Support
          </h3>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {["Help Center", "Contact Us", "Terms of Service", "Privacy Policy"].map((item) => (
              <li key={item}>
                <a
                  href="#"
                  style={{ color: "var(--muted-foreground)", fontSize: 14, textDecoration: "none", transition: "color 0.15s" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--primary)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--muted-foreground)")}
                >
                  {item}
                </a>
              </li>
            ))}
          </ul>
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
          © {new Date().getFullYear()} A1 Predictions. All rights reserved.
        </span>
        <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
          Responsible Gaming • 18+ Only
        </span>
      </div>
    </footer>
  );
}



