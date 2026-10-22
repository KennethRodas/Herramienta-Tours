import type { Metadata } from "next";
import type { ReactNode } from "react";
import { WilberShell } from "@/components/dashboard/shell";
import { THEME_BOOT_SCRIPT } from "@/components/dashboard/theme-script";

export const metadata: Metadata = {
  title: { default: "Campamento base", template: "%s · Campamento base" },
  robots: { index: false, follow: false },
};

export default function WilberLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Night ink before the first paint (sand never flashes at 4 a.m.). */}
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      <WilberShell>{children}</WilberShell>
    </>
  );
}
