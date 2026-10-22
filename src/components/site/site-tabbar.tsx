"use client";

import { usePathname } from "next/navigation";
import { HouseIcon, MapIcon, MountainIcon, TicketIcon } from "lucide-react";
import { LiquidTabBar, type LiquidTab } from "@/components/nav/liquid-tabbar";
import { useCustomer } from "@/lib/sim/customer";
import { useScrollAway } from "@/lib/use-scroll-away";

function activeTab(pathname: string) {
  if (pathname.startsWith("/aventuras") || pathname.startsWith("/salidas")) return "aventuras";
  if (pathname.startsWith("/mapa")) return "mapa";
  if (pathname.startsWith("/reserva") || pathname.startsWith("/cuenta") || pathname.startsWith("/entrar")) return "reserva";
  return "inicio";
}

/**
 * Phone navigation: the user-supplied liquid-glass tab bar, fixed above the
 * home indicator. Like an iOS 26 tab bar it gets out of the way while you read
 * down the page and comes back on any scroll up, near the top, at the end of
 * the page, on a new page, and as soon as keyboard focus enters it.
 */
export function SiteTabBar() {
  const pathname = usePathname() ?? "/";
  const { customer, ready } = useCustomer();
  const { hidden, show } = useScrollAway();

  // With a session the fourth tab opens the account (profile and bookings).
  const signedIn = ready && customer !== null;
  const tabs: LiquidTab[] = [
    { id: "inicio", label: "Inicio", href: "/", icon: <HouseIcon aria-hidden /> },
    { id: "aventuras", label: "Aventuras", href: "/aventuras", icon: <MountainIcon aria-hidden /> },
    { id: "mapa", label: "Mapa", href: "/mapa", icon: <MapIcon aria-hidden /> },
    signedIn
      ? { id: "reserva", label: "Mi cuenta", href: "/cuenta", icon: <TicketIcon aria-hidden /> }
      : { id: "reserva", label: "Mi reserva", href: "/reserva", icon: <TicketIcon aria-hidden /> },
  ];

  return (
    <nav
      aria-label="Navegación"
      onFocusCapture={show}
      className="fixed inset-x-3 z-40 md:hidden"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)",
        // Leaves quicker than it returns; both on the house curves, transform only.
        transform: hidden ? "translateY(calc(100% + 24px + env(safe-area-inset-bottom, 0px)))" : "translateY(0)",
        transition: hidden ? "transform 220ms var(--ease-out)" : "transform 320ms var(--ease-drawer)",
      }}
    >
      <LiquidTabBar tabs={tabs} activeId={activeTab(pathname)} ariaLabel="Navegación" />
    </nav>
  );
}
