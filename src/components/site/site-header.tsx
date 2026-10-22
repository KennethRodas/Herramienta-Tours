"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { SimDock } from "@/components/sim/sim-dock";
import { useCustomer } from "@/lib/sim/customer";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/aventuras", label: "Aventuras", match: ["/aventuras", "/salidas"] },
  { href: "/mapa", label: "Mapa", match: ["/mapa"] },
  { href: "/reserva", label: "Mi reserva", match: ["/reserva"] },
];

const isActive = (pathname: string, match: string[]) => match.some((m) => pathname === m || pathname.startsWith(`${m}/`));

// Plain top row, no bar: links left, the wordmark dead centre, the simulation
// clock, the account link and one action right. On the home page it is printed on the cobalt
// cover of the folder stack. Below 768px the links live in the liquid-glass
// tab bar at the bottom.
export function SiteHeader() {
  const pathname = usePathname() ?? "/";
  const home = pathname === "/";
  const { customer, ready } = useCustomer();
  // "Entrar" until the visitor's session is known, so server and client agree.
  const signedIn = ready && customer !== null;
  const firstName = customer?.name.trim().split(/\s+/)[0];
  const account = signedIn
    ? { href: "/cuenta", label: firstName || "Mi cuenta", match: ["/cuenta"] }
    : { href: "/entrar", label: "Entrar", match: ["/entrar"] };

  return (
    <header className={cn("relative z-30", home ? "field-ink" : "text-ink")}>
      <a href="#contenido" className={cn("skip-link", "pressable rounded-full bg-sand-50 px-5 py-3 text-[17px] font-semibold text-cobalt-800")}>
        Saltar al contenido
      </a>
      <div className="mx-auto grid max-w-[1760px] grid-cols-[1fr_auto_1fr] items-center px-[var(--gutter)] pt-4 pb-2 md:pt-6 md:pb-3">
        <nav aria-label="Principal" className="hidden md:block">
          <ul className="flex items-center gap-7">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isActive(pathname, link.match) ? "page" : undefined}
                  className="site-link text-[17px] font-semibold"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <Link href="/" aria-label="Wilber, tours de aventura: inicio" className="pressable col-start-2 justify-self-center">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-7 justify-self-end">
          {/* The simulation clock lives in the header so it never floats over a headline. */}
          <SimDock placement="header" />
          <Link
            href={account.href}
            aria-current={isActive(pathname, account.match) ? "page" : undefined}
            className="site-link hidden max-w-[14ch] truncate py-1 text-[17px] font-semibold md:block"
          >
            {account.label}
          </Link>
          <ButtonLink href="/aventuras" variant={home ? "inverse" : "primary"} className="hidden md:inline-flex">
            Reservar
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
