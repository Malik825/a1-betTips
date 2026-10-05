import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Home, Target, Crown, User, LayoutDashboard,
  CreditCard, Settings, LogOut, X, ChevronRight,
} from "lucide-react";

import appCss from "../styles.css?url";
import dashboardCss from "../dashboard-theme.css?url";
import { Toaster } from "@/components/ui/sonner";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { ThemeProvider } from "@/lib/theme-provider";
import { PageTransition } from "@/components/page-transition";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(err);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(err, { boundary: "tanstack_root_error_component" });
  }, [err]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" },
      { title: "A1-TIPSDECK — Premium Sports Analytics & Predictions" },
      {
        name: "description",
        content: "Daily free and VIP sports analytics with expert analysis.",
      },
      { name: "author", content: "A1-TIPSDECK" },
      { property: "og:title", content: "A1-TIPSDECK — Premium Sports Analytics" },
      {
        property: "og:description",
        content: "Daily free and VIP sports analytics with expert analysis.",
      },
      { property: "og:image", content: "https://a1-tipsdeck.com/og-image.jpg" },
      { property: "og:url", content: "https://a1-tipsdeck.com" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@A1TipsDeck" },
      { name: "twitter:image", content: "https://a1-tipsdeck.com/og-image.jpg" },
    ],
    links: [
      { rel: "canonical", href: "https://a1-tipsdeck.com" },
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: dashboardCss },
      { rel: "icon", href: "/favicon.jpg", type: "image/jpeg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap",
      },
    ],
    scripts: [{ src: "https://js.paystack.co/v1/inline.js" }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="bg-background">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

// ── Account Drawer ───────────────────────────────────────────
function AccountDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onClose();
    navigate({ to: "/" });
  };

  const go = (to: string) => {
    onClose();
    navigate({ to } as any);
  };

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "My Account";
  const email = user?.email || "";

  return (
    <>
      {/* Backdrop */}
      <div
        className={`lg:hidden fixed inset-0 z-[99998] bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={`lg:hidden fixed bottom-0 left-0 right-0 z-[99999] bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-white/20" />
        </div>

        {/* User info header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-white/10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-green-500/15 border-2 border-green-500/30 flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{displayName}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{email}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-all shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Menu items */}
        <div className="px-3 py-3 space-y-1">
          <DrawerItem
            icon={<LayoutDashboard className="w-[18px] h-[18px]" />}
            label="Dashboard"
            description="Your stats & active tickets"
            onClick={() => go("/dashboard")}
          />
          <DrawerItem
            icon={<CreditCard className="w-[18px] h-[18px]" />}
            label="Payment History"
            description="View your submitted payments"
            onClick={() => go("/dashboard")}
          />
          <DrawerItem
            icon={<Crown className="w-[18px] h-[18px]" />}
            label="VIP Packages"
            description="Browse premium tips"
            onClick={() => go("/vip")}
          />
          <DrawerItem
            icon={<Settings className="w-[18px] h-[18px]" />}
            label="Settings"
            description="Profile & preferences"
            onClick={() => go("/dashboard")}
          />
        </div>

        {/* Sign out */}
        <div className="px-3 pb-8 pt-1 border-t border-slate-100 dark:border-white/10 mt-1">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors group"
          >
            <span className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center group-hover:bg-red-100 dark:group-hover:bg-red-500/20 transition-colors shrink-0">
              <LogOut className="w-4 h-4" />
            </span>
            <div className="text-left">
              <p className="text-sm font-bold">Sign Out</p>
              <p className="text-xs text-red-400">Log out of your account</p>
            </div>
          </button>
        </div>
      </div>
    </>
  );
}

function DrawerItem({
  icon, label, description, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group text-left"
    >
      <span className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300 group-hover:bg-green-50 dark:group-hover:bg-green-500/10 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors shrink-0">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{label}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{description}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
    </button>
  );
}

// ── Mobile Bottom Nav ────────────────────────────────────────
function MobileNav() {
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-[9999] bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200 dark:border-white/10 shadow-[0_-4px_25px_rgba(0,0,0,0.05)] pb-1 sm:pb-2 pt-2 px-4">
        <div className="flex items-center justify-between max-w-sm mx-auto">
          <Link
            to="/"
            className="flex flex-col items-center justify-center gap-1 w-16 group"
            activeProps={{ className: "text-green-500 font-bold" }}
            activeOptions={{ exact: true }}
          >
            <Home className="w-6 h-6 text-slate-400 group-hover:text-green-500 transition-colors [[data-status=active]_&]:text-green-500" />
            <span className="text-[9px] font-semibold text-slate-500 [[data-status=active]_&]:text-green-500">Home</span>
          </Link>

          <Link
            to="/predictions"
            className="flex flex-col items-center justify-center gap-1 w-16 group"
            activeProps={{ className: "text-green-500 font-bold" }}
          >
            <Target className="w-6 h-6 text-slate-400 group-hover:text-green-500 transition-colors [[data-status=active]_&]:text-green-500" />
            <span className="text-[9px] font-semibold text-slate-500 [[data-status=active]_&]:text-green-500">Tips</span>
          </Link>

          <Link
            to="/vip"
            className="flex flex-col items-center justify-center gap-1 w-16 group"
            activeProps={{ className: "text-green-500 font-bold" }}
          >
            <Crown className="w-6 h-6 text-slate-400 group-hover:text-green-500 transition-colors [[data-status=active]_&]:text-green-500" />
            <span className="text-[9px] font-semibold text-slate-500 [[data-status=active]_&]:text-green-500">VIP</span>
          </Link>

          {user ? (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex flex-col items-center justify-center gap-1 w-16 group cursor-pointer"
            >
              <User className="w-6 h-6 text-slate-400 group-hover:text-green-500 transition-colors" />
              <span className="text-[9px] font-semibold text-slate-500 group-hover:text-green-500">Account</span>
            </button>
          ) : (
            <Link
              to="/login"
              className="flex flex-col items-center justify-center gap-1 w-16 group"
              activeProps={{ className: "text-green-500 font-bold" }}
            >
              <User className="w-6 h-6 text-slate-400 group-hover:text-green-500 transition-colors [[data-status=active]_&]:text-green-500" />
              <span className="text-[9px] font-semibold text-slate-500 [[data-status=active]_&]:text-green-500">Login</span>
            </Link>
          )}
        </div>
      </nav>

      {user && <AccountDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />}
    </>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <PageTransition>
            {/* pb-20 on mobile prevents content from hiding under the fixed bottom nav */}
            <div className="pb-20 lg:pb-0">
              <Outlet />
            </div>
          </PageTransition>
          <MobileNav />
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
