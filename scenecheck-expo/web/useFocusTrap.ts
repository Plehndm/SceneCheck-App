// useFocusTrap — keyboard-focus containment for transient web overlays
// (slide-overs, popovers, activity panel).
//
// While `open` is true:
//   • Focus jumps into the first focusable element inside `panelRef`.
//   • Tab cycles through focusables in the panel — Shift+Tab from the
//     first wraps to the last; Tab from the last wraps to the first.
//
// When `open` flips back to false:
//   • If `triggerRef` was supplied, focus is restored to it (e.g. the
//     button that opened the overlay).
//
// SSR-safe: bails out on the server where `window`/`document` are
// undefined. This matches WCAG 2.1 SC 2.1.2 (No Keyboard Trap, in the
// sense that ESC + restore exit cleanly) and SC 2.4.3 (Focus Order).
// See `docs/WEB_BUILD_REVIEW.md` H-02 for the source spec.

import { useEffect, type RefObject } from 'react';

// Selector for elements that can receive Tab focus inside the panel.
// `[autofocus]` first so an explicit autofocus wins for initial focus.
const FOCUSABLE_FIRST =
  '[autofocus],button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';
const FOCUSABLE_ALL =
  'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';

export function useFocusTrap(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  triggerRef?: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!open) {
      // Restore focus to the opener on close. Guarded because the
      // trigger may have unmounted (e.g. nav change closes the panel).
      triggerRef?.current?.focus();
      return;
    }

    const panel = panelRef.current;
    if (!panel) return;

    // Initial focus inside the panel.
    const first = panel.querySelector<HTMLElement>(FOCUSABLE_FIRST);
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusables = panel.querySelectorAll<HTMLElement>(FOCUSABLE_ALL);
      if (!focusables.length) return;
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    panel.addEventListener('keydown', onKey);
    return () => panel.removeEventListener('keydown', onKey);
  }, [open, panelRef, triggerRef]);
}
