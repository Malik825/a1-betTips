import { type ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";

/**
 * Wraps page content with a smooth fade-in transition on route changes.
 * Declarative key ensures clean animation triggers without forced DOM reflows
 * or layout shifts affecting sticky/fixed headers.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith("/admin");

  // Admin routes: render directly without transition wrappers
  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <div key={pathname} className="page-transition-enter w-full min-h-screen flex flex-col">
      {children}
    </div>
  );
}
