"use client";

import { useState } from "react";

/**
 * Wraps a second copy of the sidebar content in a drawer for viewports
 * under 900px, where the desktop sidebar is hidden entirely
 * (globals.css's `.sidebar { display: none }`) with nothing replacing
 * it -- a real navigation dead-end on mobile, not just a style gap.
 * Rendering the sidebar twice (desktop flow + this drawer) and letting
 * CSS decide which is visible is simpler and safer here than trying to
 * portal a single instance between two locations. The nav links inside
 * are plain <a> tags, so a real navigation naturally unmounts this
 * component and resets `open` to false -- no explicit close-on-navigate
 * wiring needed.
 *
 * The open/closed drawer is driven by conditional rendering, not a CSS
 * transform/transition -- deliberately, not for lack of trying. A CSS
 * class-based slide animation was built first and step-by-step verified
 * to genuinely not repaint in this session's test environment (the
 * inline `style` attribute correctly updated on click, confirmed via
 * getAttribute; getBoundingClientRect still reported the closed
 * position afterward, confirmed on a completely fresh tab to rule out
 * state pollution) while the *same pane* had separately reported it
 * wasn't compositing frames (a screenshot attempt failed with "the
 * Browser pane is not displayed, so the page is not compositing
 * frames"). That's very likely a backgrounded-pane rendering artifact
 * specific to this test tool, not a real-browser bug -- but since it
 * couldn't be visually confirmed either way without the user present,
 * this drops the animation and switches to plain conditional mounting,
 * which has no compositing/transform dependency to get wrong. Revisit
 * adding the slide-in polish back once it can be checked with the pane
 * actually visible.
 */
export function MobileNavShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="mobile-nav-toggle" onClick={() => setOpen(true)} aria-label="Open navigation">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {open && (
        <>
          <div className="mobile-nav-overlay" onClick={() => setOpen(false)} />
          <div className="mobile-nav-drawer">
            <button className="mobile-nav-close" onClick={() => setOpen(false)} aria-label="Close navigation">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            {children}
          </div>
        </>
      )}
    </>
  );
}
