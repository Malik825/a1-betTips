import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import heroStadium from "@/assets/hero-stadium.jpg";
import logo from "@/assets/logo-horizontal.jpg";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Visual side */}
      <aside className="relative hidden lg:block">
        <img
          src={heroStadium}
          alt="Floodlit football stadium at night"
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <Link to="/" aria-label="A1 PREDICTIONS home">
            <img src={logo} alt="A1 PREDICTIONS" className="h-10 w-auto object-contain invert transition-all" />
          </Link>
          <div className="flex flex-col items-center text-center w-full">
            <p className="text-gray-200 text-xs lg:text-sm font-bold uppercase tracking-[0.2em] mb-2 drop-shadow-md">
              Your Premier Destination For
            </p>
            <h2 className="flex flex-col items-center justify-center text-white text-3xl lg:text-5xl font-black uppercase tracking-tighter leading-none mb-2 drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]">
              <span className="font-sans" style={{ fontStretch: 'condensed' }}>Professional</span>
              <span className="text-primary drop-shadow-[0_0_15px_rgba(34,197,94,0.4)] font-sans" style={{ fontStretch: 'condensed' }}>Sports Betting</span>
            </h2>
            <h3 className="text-gray-100 text-lg lg:text-2xl font-black uppercase tracking-tight mb-8 drop-shadow-md">
              Tips and Predictions.
            </h3>
            <div className="flex flex-col items-center gap-1">
              <p className="text-gray-200 text-xs lg:text-sm font-bold uppercase tracking-wide drop-shadow-md">
                Join thousands of <span className="text-primary">successful bettors</span>
              </p>
              <p className="text-gray-300 text-[10px] lg:text-xs font-bold uppercase italic tracking-wide drop-shadow-md">
                before you. Trust A1 PREDICTIONS for <span className="text-primary">winning strategies.</span>
              </p>
            </div>
            <dl className="mt-10 grid grid-cols-3 gap-8 text-center">
              {[
                ["92%", "Win rate"],
                ["25k+", "Members"],
                ["10+", "Tips daily"],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="font-display text-2xl text-[#22c55e]">{v}</dt>
                  <dd className="text-xs uppercase tracking-wider text-white/60">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </aside>

      {/* Form side */}
      <section className="flex items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-md">
          <Link to="/" aria-label="A1 PREDICTIONS home">
            <img src={logo} alt="A1 PREDICTIONS" className="h-10 w-auto object-contain rounded-sm" />
          </Link>
          <h1 className="mt-6 font-display text-3xl uppercase text-foreground lg:mt-0">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-6 text-sm text-muted-foreground">{footer}</div>
        </div>
      </section>
    </main>
  );
}

export function AuthField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase tracking-wider text-foreground">
        {label}
      </label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

