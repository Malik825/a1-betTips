import { useEffect, useRef, type ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";

/**
 * Wraps page content with a smooth fade-slide-up animation on route changes.
 * The animation re-triggers each time the pathname changes.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Reset then restart the animation
    el.classList.remove("page-transition-enter");
    // Force reflow so the removal is flushed before adding back
    void el.offsetWidth;
    el.classList.add("page-transition-enter");
  }, [pathname]);

  return (
    <div ref={ref} className="page-transition-enter">
      {children}
    </div>
  );
}
