import { useEffect, useRef, type ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";

/**
 * Wraps page content with a smooth fade-slide-up animation on route changes.
 * Skipped for admin routes to prevent sidebar shaking caused by CSS transforms
 * interfering with fixed-positioned elements.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  const isAdmin = pathname.startsWith("/admin");

  useEffect(() => {
    const el = ref.current;
    if (!el || isAdmin) return;

    // Reset then restart the animation
    el.classList.remove("page-transition-enter");
    // Force reflow so the removal is flushed before adding back
    void el.offsetWidth;
    el.classList.add("page-transition-enter");
  }, [pathname, isAdmin]);

  // Admin routes: render with no animation wrapper transforms
  if (isAdmin) {
    return <div ref={ref}>{children}</div>;
  }

  return (
    <div ref={ref} className="page-transition-enter">
      {children}
    </div>
  );
}
