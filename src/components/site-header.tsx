import React from "react";
import { Link, useLocation } from "@tanstack/react-router";
import logo from "@/assets/logo-horizontal.jpg";
import { useState, useEffect } from "react";
import { LogOut, Menu, X, ChevronDown, User, LayoutDashboard, Settings } from "lucide-react";
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
  { label: "Predictions", to: "/predictions" },
  { label: "VIP Access", to: "/vip" },
  { label: "About Us", to: "/about" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user } = useAuth();
  const headerRef = React.useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setOpen(false);
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

  const isAdmin = profile?.role === "admin" || user?.app_metadata?.role === "admin";
  const displayName = user?.user_metadata?.name || user?.email?.split("@")[0] || "there";

  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <header ref={headerRef} className="sticky top-0 z-50 transition-all duration-300 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-black/5 dark:border-white/5 shadow-sm overflow-hidden">
      
      
      <div className="relative z-10 mx-auto flex h-16 max-w-7xl items-center justify-between px-6 md:px-10 lg:px-12">
        <Link to="/" className="flex items-center gap-1">
          <img src={logo} alt="A1 Predictions" className="h-10 w-auto object-contain transition-all" />
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-8 md:flex">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-sm font-semibold transition-colors text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              activeProps={{ className: "text-green-500" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <ThemeToggle />
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors outline-none focus:ring-2 focus:ring-green-500/50 border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10">
                  <User className="size-4" />
                  <span className="max-w-32 truncate">Hi, {displayName}</span>
                  <ChevronDown className="size-4 opacity-50" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 font-medium">
                <DropdownMenuItem asChild>
                  <Link to="/dashboard" className="cursor-pointer flex items-center">
                    <LayoutDashboard className="mr-2 size-4" />
                    Dashboard
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="cursor-pointer flex items-center text-green-500 hover:text-green-600 focus:text-green-600">
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
          <button
            className="transition-colors text-black dark:text-white"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>

      <div className={`absolute top-full left-0 right-0 md:hidden grid transition-all duration-300 ease-in-out bg-background ${open ? "grid-rows-[1fr] opacity-100 border-t border-black/10 dark:border-white/10 shadow-lg shadow-black/10" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <div className="mx-auto flex flex-col p-4 gap-1">
            {nav.map((item) => (
              <Link key={item.to} to={item.to} onClick={() => setOpen(false)} className="px-4 py-3 text-[15px] font-bold text-foreground text-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                {item.label}
              </Link>
            ))}
            <div className="mt-4 flex flex-col gap-3 px-2">
              {user ? (
                <>
                  <span className="py-1 text-center text-[13px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest">Hi, {displayName}</span>
                  <Link to="/dashboard" onClick={() => setOpen(false)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black px-4 py-3.5 text-[15px] font-bold transition-all shadow-md active:scale-95">
                    <LayoutDashboard className="size-5" />
                    Dashboard
                  </Link>
                  {isAdmin && (
                    <Link to="/admin" onClick={() => setOpen(false)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3.5 text-[15px] font-bold text-green-600 dark:text-green-500 transition-colors">
                      <Settings className="size-5" />
                      Admin Console
                    </Link>
                  )}
                  <button type="button" onClick={handleLogout} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-900 px-4 py-3.5 text-[15px] font-bold text-red-600 dark:text-red-500 transition-colors">
                    <LogOut className="size-5" />
                    Log out
                  </button>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <Link to="/login" onClick={() => setOpen(false)} className="inline-flex w-full items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-3.5 text-[15px] font-bold text-foreground transition-all">Login</Link>
                  <Link to="/register" onClick={() => setOpen(false)} className="inline-flex w-full items-center justify-center rounded-xl bg-green-500 text-black px-4 py-3.5 text-[15px] font-bold transition-all shadow-md active:scale-95">Register</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}






