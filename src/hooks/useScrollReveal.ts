import { useEffect, useRef } from "react";

/**
 * Attaches an IntersectionObserver to a container element and adds the
 * `in-view` class to any child with the `sr` class when it enters the viewport.
 *
 * Usage:
 *   const ref = useScrollReveal();
 *   <section ref={ref}>
 *     <h2 className="sr sr-up">Title</h2>
 *     <p  className="sr sr-up sr-delay-2">Body</p>
 *   </section>
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options?: IntersectionObserverInit,
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const targets = container.querySelectorAll<HTMLElement>(".sr");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            // Once revealed, stop observing that element
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -40px 0px",
        ...options,
      },
    );

    targets.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [options]);

  return ref;
}
