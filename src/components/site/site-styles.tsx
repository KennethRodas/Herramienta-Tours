// Shared CSS for the public site that Tailwind classes cannot express.
// Ink scopes only reset role variables (never background or colour), so the
// usual utilities (`bg-*`, `text-ink`) keep working on the same element.

const CSS = `
.ink-paper {
  --ink: var(--cobalt-800); --ink-soft: var(--cobalt-600);
  --foreground: var(--cobalt-800); --muted-foreground: var(--cobalt-600); --background: var(--sand-50);
  --primary: var(--cobalt-800); --primary-foreground: var(--sand-50); --ring: var(--cobalt-800);
  --border: rgb(6 43 138 / 0.16); color-scheme: light;
}
.ink-night {
  --ink: var(--sand-100); --ink-soft: var(--cobalt-300);
  --foreground: var(--sand-100); --muted-foreground: var(--cobalt-300); --background: var(--cobalt-950);
  --primary: var(--sand-100); --primary-foreground: var(--cobalt-800); --ring: var(--sand-100);
  --border: rgb(238 230 214 / 0.16); color-scheme: dark;
}
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
`;

export function SiteStyles() {
  return <style>{CSS}</style>;
}
