"use client";

import { useEffect } from "react";

/**
 * Pins a `--app-height` CSS variable to the real *visible* viewport height.
 *
 * Mobile browsers report `100vh` (and sometimes `100dvh`) as taller than the
 * area you can actually see, which pushes the message composer below the fold
 * and forces the user to scroll down to type. Using `window.visualViewport`
 * (falling back to `innerHeight`) gives the true visible height, and it also
 * shrinks when the on-screen keyboard opens — so the composer stays parked
 * just above the keyboard instead of being hidden behind it.
 */
export default function ViewportHeight() {
  useEffect(() => {
    const vv = window.visualViewport;
    const apply = () => {
      const h = vv?.height ?? window.innerHeight;
      document.documentElement.style.setProperty("--app-height", `${h}px`);
    };
    apply();
    vv?.addEventListener("resize", apply);
    vv?.addEventListener("scroll", apply);
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      vv?.removeEventListener("resize", apply);
      vv?.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
    };
  }, []);

  return null;
}
