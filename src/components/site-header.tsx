import React from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Logo } from "@/components/logo";
import { LogOut, ChevronDown, User, LayoutDashboard, Settings, Home, Target, Crown, Info, Repeat } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const nav = [
  { label: "Home", to: "/" },
  { label: "Analytics", to: "/predictions" },
  { label: "VIP Access", to: "/vip" },
  { label: "Subscriptions", to: "/subscriptions" },
  { label: "About Us", to: "/about" },
  { label: "Contact", to: "/contact" },
] as const;

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const { user } = useAuth();
  const headerRef = React.useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (error) return null;
      return data;
    },
    enabled: !!user,
  });

  const { data: userSubscriptions = [] } = useQuery({
    queryKey: ["user_subscriptions_header", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("subscriptions")
        .select("subscription_type, status, expires_at")
        .eq("user_id", user.id)
        .eq("status", "active");
      if (error) return [];
      return data || [];
    },
    enabled: !!user,
  });

  const hasAllAccess = userSubscriptions.some(
    (s: any) =>
      s.subscription_type === "all_access" &&
      s.expires_at &&
      new Date(s.expires_at) > new Date()
  );

  const isAdmin = profile?.role === "admin" || user?.app_metadata?.role === "admin";
  const displayName = user?.user_metadata?.name || user?.email?.split("@")[0] || "there";

  const location = useLocation();

  return (
    <>
      <header ref={headerRef} className="sticky top-0 z-[999] transition-colors duration-200 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-black/5 dark:border-white/5 shadow-sm">
        <div className="relative z-10 mx-auto flex h-16 max-w-7xl items-center justify-between px-6 md:px-10 lg:px-12">
          <Link to="/" className="flex items-center gap-1">
            <Logo className="h-9" />
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-8 md:flex">
            {nav.map((item) => {
              const target = (hasAllAccess && (item.to === "/vip" || item.to === "/subscriptions"))
                ? "/dashboard"
                : item.to;
              const label = (hasAllAccess && item.to === "/subscriptions")
                ? "👑 VIP Dashboard"
                : item.label;

              return (
                <Link
                  key={item.to}
                  to={target}
                  className="text-sm font-semibold transition-colors text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                  activeProps={{ className: "text-emerald-500 font-bold" }}
                  activeOptions={{ exact: item.to === "/" }}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-4 md:flex">
            <ThemeToggle />
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors outline-none focus:ring-2 focus:ring-emerald-500/50 border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10">
                    <User className="size-4" />
                    <span className="max-w-32 truncate">Hi, {displayName}</span>
                    <ChevronDown className="size-4 opacity-50" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 font-medium">
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard" className="cursor-pointer flex items-center">
                      <LayoutDashboard className="mr-2 size-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/subscriptions" className="cursor-pointer flex items-center">
                      <Repeat className="mr-2 size-4 text-emerald-500" />
                      VIP Subscriptions
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin" className="cursor-pointer flex items-center text-emerald-500 hover:text-emerald-600 focus:text-emerald-600">
                        <Settings className="mr-2 size-4" />
                        Admin Console
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive flex items-center">
                    <LogOut className="mr-2 size-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Link to="/login" className="text-sm font-semibold transition-colors text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">Login</Link>
                <Link to="/register" className="rounded bg-green-500 hover:bg-green-600 px-5 py-2 text-sm font-bold text-black transition-transform hover:-translate-y-0.5 shadow-sm">Register</Link>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
          </div>
        </div>
      </header>


    </>
  );
}



