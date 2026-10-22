// Shared CSS for the public site that Tailwind classes cannot express.
// (The ink scopes `.ink-paper` / `.ink-night` now live in globals.css.)

const CSS = `
.site-link {
  text-decoration-line: underline; text-decoration-thickness: 2px; text-underline-offset: 0.3em;
  text-decoration-color: transparent;
  transition: text-decoration-color var(--dur-fast) ease, opacity var(--dur-press) ease;
}
.site-link[aria-current="page"] { text-decoration-color: currentColor; }
.site-link:active { opacity: 0.7; }
@media (hover: hover) and (pointer: fine) { .site-link:hover { text-decoration-color: currentColor; } }
.skip-link { position: absolute; left: var(--gutter); top: -100px; z-index: 60; }
.skip-link:focus-visible { top: 12px; }

/* Manila folder tab (see folder-tab.tsx). Placed by its parent with left/right. */
.ft { position: absolute; bottom: calc(100% - 1px); display: flex; height: 40px; margin: 0; }
.ft-end { position: relative; z-index: 1; flex: none; width: 26px; height: 40px; fill: var(--c); }
/* First-screen entrances: CSS from the first paint, so nothing waits for JS. */
@media (prefers-reduced-motion: no-preference) {
  .rise-in { animation: site-rise 0.8s var(--ease-out) backwards; animation-delay: calc(var(--i, 0) * 75ms + 60ms); }
}
@keyframes site-rise { from { opacity: 0; transform: translateY(20px); } }

.ft-mid {
  position: relative; display: flex; align-items: center; height: 40px; margin: 0 -1px; padding: 0 10px;
  background: var(--c); color: var(--t); white-space: nowrap;
  font-family: var(--font-sans); font-size: 17px; font-weight: 600; line-height: 1; letter-spacing: 0;
}
`;

export function SiteStyles() {
  return <style>{CSS}</style>;
}
