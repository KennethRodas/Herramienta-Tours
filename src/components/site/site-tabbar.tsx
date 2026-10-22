"use client";

import { usePathname } from "next/navigation";
import { HouseIcon, MapIcon, MountainIcon, TicketIcon } from "lucide-react";
import { LiquidTabBar, type LiquidTab } from "@/components/nav/liquid-tabbar";
import { useCustomer } from "@/lib/sim/customer";

function activeTab(pathname: string) {
  if (pathname.startsWith("/aventuras") || pathname.startsWith("/salidas")) return "aventuras";
  if (pathname.startsWith("/mapa")) return "mapa";
  if (pathname.startsWith("/reserva") || pathname.startsWith("/cuenta") || pathname.startsWith("/entrar")) return "reserva";
  return "inicio";
}

/** Phone navigation: the user-supplied liquid-glass tab bar, fixed above the home indicator. */
export function SiteTabBar() {
  const pathname = usePathname() ?? "/";
  const { customer, ready } = useCustomer();
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
      className="fixed inset-x-3 z-40 md:hidden"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)" }}
    >
      <LiquidTabBar tabs={tabs} activeId={activeTab(pathname)} ariaLabel="Navegación" />
    </nav>
  );
}
