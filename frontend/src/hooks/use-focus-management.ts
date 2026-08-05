import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Manages focus on route changes for accessibility.
 * Moves focus to the main content area when navigation occurs.
 */
export function useFocusOnRouteChange() {
  const location = useLocation();

  useEffect(() => {
    // Focus the main content on route change for screen readers
    const main = document.querySelector("main") || document.querySelector("[role='main']");
    if (main instanceof HTMLElement) {
      main.setAttribute("tabindex", "-1");
      main.focus({ preventScroll: true });
      // Remove tabindex after focus to avoid it being in the tab order
      main.removeAttribute("tabindex");
    }
  }, [location.pathname]);
}

/**
 * Respects prefers-reduced-motion.
 * Returns true if the user prefers reduced motion.
 */
export function usePrefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
