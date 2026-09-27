import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Home, Target, Crown, User } from "lucide-react";

import appCss from "../styles.css?url";
import dashboardCss from "../dashboard-theme.css?url";
import { Toaster } from "@/components/ui/sonner";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider, useAuth } from "@/lib/auth-context";

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

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

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
      { title: "A1 GROUP INSIGHTS — Premium Sports Analytics & Match Insights" },
      {
        name: "description",
        content: "Daily free and VIP sports analytics with expert analysis.",
      },
      { name: "author", content: "A1 GROUP INSIGHTS" },
      { property: "og:title", content: "A1 GROUP INSIGHTS — Premium Football Predictions" },
      {
        property: "og:description",
        content: "Daily free and VIP sports analytics with expert analysis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@A1Predictions" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "stylesheet",
        href: dashboardCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap",
      },
    ],
    scripts: [
      {
        src: "https://js.paystack.co/v1/inline.js",
      },
    ],
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

import { ThemeProvider } from "@/lib/theme-provider";
import { PageTransition } from "@/components/page-transition";

function MobileNav() {
  const { user } = useAuth();
  
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-[9999] bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200 dark:border-white/10 shadow-[0_-4px_25px_rgba(0,0,0,0.05)] pb-1 sm:pb-2 pt-2 px-4">
      <div className="flex items-center justify-between max-w-sm mx-auto">
        <Link to="/" className="flex flex-col items-center justify-center gap-1 w-16 group" activeProps={{ className: "text-green-500 font-bold" }} activeOptions={{ exact: true }}>
          <Home className="w-6 h-6 text-slate-400 group-hover:text-green-500 transition-colors [[data-status=active]_&]:text-green-500" />
          <span className="text-[9px] font-semibold text-slate-500 [[data-status=active]_&]:text-green-500">Home</span>
        </Link>
        <Link to="/predictions" className="flex flex-col items-center justify-center gap-1 w-16 group" activeProps={{ className: "text-green-500 font-bold" }}>
          <Target className="w-6 h-6 text-slate-400 group-hover:text-green-500 transition-colors [[data-status=active]_&]:text-green-500" />
          <span className="text-[9px] font-semibold text-slate-500 [[data-status=active]_&]:text-green-500">Tips</span>
        </Link>
        <Link to="/vip" className="flex flex-col items-center justify-center gap-1 w-16 group" activeProps={{ className: "text-green-500 font-bold" }}>
          <Crown className="w-6 h-6 text-slate-400 group-hover:text-green-500 transition-colors [[data-status=active]_&]:text-green-500" />
          <span className="text-[9px] font-semibold text-slate-500 [[data-status=active]_&]:text-green-500">VIP</span>
        </Link>
        {user ? (
          <Link to="/dashboard" className="flex flex-col items-center justify-center gap-1 w-16 group" activeProps={{ className: "text-green-500 font-bold" }}>
            <User className="w-6 h-6 text-slate-400 group-hover:text-green-500 transition-colors [[data-status=active]_&]:text-green-500" />
            <span className="text-[9px] font-semibold text-slate-500 [[data-status=active]_&]:text-green-500">Account</span>
          </Link>
        ) : (
          <Link to="/login" className="flex flex-col items-center justify-center gap-1 w-16 group" activeProps={{ className: "text-green-500 font-bold" }}>
            <User className="w-6 h-6 text-slate-400 group-hover:text-green-500 transition-colors [[data-status=active]_&]:text-green-500" />
            <span className="text-[9px] font-semibold text-slate-500 [[data-status=active]_&]:text-green-500">Login</span>
          </Link>
        )}
      </div>
    </nav>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <PageTransition>
            {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
            <Outlet />
          </PageTransition>
          <MobileNav />
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
