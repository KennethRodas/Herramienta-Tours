import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { SiteStyles } from "@/components/site/site-styles";
import { SiteTabBar } from "@/components/site/site-tabbar";
import { SmoothScroll } from "@/components/site/smooth-scroll";

// Chrome for every public page: plain top row (desktop), liquid-glass tab bar
// (phone), the back-of-the-card footer, Lenis + ScrollTrigger.
export default function SitioLayout({ children }: { children: ReactNode }) {
  return (
    <SmoothScroll>
      <SiteStyles />
      <SiteHeader />
      <main id="contenido" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <SiteFooter />
      <SiteTabBar />
    </SmoothScroll>
  );
}
