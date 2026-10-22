"use client";

import {
  CalendarDays,
  ChartColumn,
  ChevronRight,
  Ellipsis,
  FlaskConical,
  Globe,
  MessageCircle,
  Moon,
  Route,
  Search,
  Settings,
  Shuffle,
  Smartphone,
  Sun,
  SunMoon,
  Tent,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";
import { toast } from "sonner";
import { LogoMark } from "@/components/brand/logo";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import { LiquidTabBar } from "@/components/nav/liquid-tabbar";
import { Tooltip } from "@/components/motion/tooltip";
import { formatDayShort, formatTime } from "@/lib/domain/format";
import { SPRING_LAYOUT } from "@/lib/ease";
import { useClock, useNow } from "@/lib/sim/hooks";
import { cn } from "@/lib/utils";
import { THEME_LABEL, useEffectiveTheme, useThemeMode, type ThemeMode } from "./hooks";
import { Chips, IconBtn, Kbd } from "./ui";

export interface NavItem {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV: NavItem[] = [
  { id: "hoy", href: "/wilber", label: "Hoy", icon: Tent },
  { id: "salidas", href: "/wilber/salidas", label: "Salidas", icon: CalendarDays },
  { id: "reservas", href: "/wilber/reservas", label: "Reservas", icon: Ticket },
  { id: "cruces", href: "/wilber/cruces", label: "Cruces", icon: Shuffle },
  { id: "numeros", href: "/wilber/numeros", label: "Números", icon: ChartColumn },
  { id: "rutas", href: "/wilber/rutas", label: "Rutas", icon: Route },
  { id: "whatsapp", href: "/wilber/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "ajustes", href: "/wilber/ajustes", label: "Ajustes", icon: Settings },
  { id: "instalar", href: "/wilber/instalar", label: "Instalar app", icon: Smartphone },
];

export const OUTSIDE: NavItem[] = [
  { id: "simulador", href: "/simulador", label: "Simulador", icon: FlaskConical },
  { id: "sitio", href: "/", label: "Ver sitio", icon: Globe },
];

const TAB_IDS = ["hoy", "salidas", "reservas", "cruces"];

export function navIdFor(pathname: string) {
  const match = [...NAV].sort((a, b) => b.href.length - a.href.length).find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`));
  return match?.id ?? "hoy";
}

export function titleFor(pathname: string) {
  return NAV.find((n) => n.id === navIdFor(pathname))?.label ?? "Hoy";
}

// --- Clock ---------------------------------------------------------------------------

/** The simulated clock in El Salvador time; the simulator can speed it up or stop it. */
export function SimClock({ compact = false }: { compact?: boolean }) {
  const now = useNow(1000);
  const clock = useClock();
  if (now === null || !clock) return <span className="h-9 w-24" aria-hidden />;
  const fast = clock.speed !== 1;
  return (
    <div className={cn("flex flex-col items-end leading-none", compact && "flex-row items-baseline gap-2")} aria-label={`Hora simulada: ${formatTime(now)}`}>
      <span className="font-display text-[20px] font-bold tabular text-ink">{formatTime(now)}</span>
      <span className={cn("text-[12px] font-medium text-ink-soft", !compact && "mt-1")}>
        {compact ? null : formatDayShort(now)}
        {clock.paused ? (compact ? "pausa" : " · pausa") : fast ? `${compact ? "" : " · "}×${clock.speed}` : null}
      </span>
    </div>
  );
}

// --- Theme ---------------------------------------------------------------------------

const NEXT_MODE: Record<ThemeMode, ThemeMode> = { auto: "dia", dia: "noche", noche: "auto" };

export function ThemeButton() {
  const [mode, setMode] = useThemeMode();
  const effective = useEffectiveTheme();
  const Icon = mode === "auto" ? SunMoon : mode === "dia" ? Sun : Moon;
  const label = `Tema: ${THEME_LABEL[mode]}${mode === "auto" ? ` (${effective === "noche" ? "noche" : "día"})` : ""}`;
  return (
    <Tooltip content={label} side="bottom">
      <IconBtn
        label={label}
        onClick={() => {
          const next = NEXT_MODE[mode];
          setMode(next);
          toast(`Tema: ${THEME_LABEL[next]}`);
        }}
      >
        <Icon className="size-5" />
      </IconBtn>
    </Tooltip>
  );
}

export function ThemeChips({ className }: { className?: string }) {
  const [mode, setMode] = useThemeMode();
  return (
    <Chips<ThemeMode>
      label="Tema"
      value={mode}
      onChange={setMode}
      className={className}
      options={[
        { value: "auto", label: "Automático" },
        { value: "dia", label: "Día" },
        { value: "noche", label: "Noche" },
      ]}
    />
  );
}

// --- Desktop -------------------------------------------------------------------------

function SideLink({ item, active, badge }: { item: NavItem; active: boolean; badge?: number }) {
  const reduce = useReducedMotion();
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "pressable relative isolate flex h-11 items-center gap-3 rounded-full px-3.5 text-[16px] font-semibold select-none [-webkit-touch-callout:none]",
        active ? "text-paper" : "text-ink hover:bg-ink/8",
      )}
    >
      {active ? (
        <motion.span layoutId="wilber-side-active" transition={reduce ? { duration: 0 } : SPRING_LAYOUT} className="absolute inset-0 -z-10 rounded-full bg-ink" />
      ) : null}
      <Icon className="size-5 shrink-0" aria-hidden />
      <span className="flex-1 truncate">{item.label}</span>
      {badge ? (
        <span className="grid h-6 min-w-6 place-items-center rounded-full bg-destructive px-1.5 text-[12px] font-bold tabular text-paper">{badge}</span>
      ) : null}
    </Link>
  );
}

export function Sidebar({ conflicts }: { conflicts: number }) {
  const pathname = usePathname();
  const active = navIdFor(pathname);
  return (
    <aside className="sticky top-3 m-3 mr-0 hidden h-[calc(100dvh-24px)] w-[248px] shrink-0 flex-col overflow-y-auto rounded-ticket bg-paper text-paper-ink lg:flex">
      <Link href="/wilber" className="pressable m-2 flex h-16 shrink-0 items-center gap-3 rounded-field px-3 select-none hover:bg-ink/6">
        <LogoMark className="size-10" paper="var(--ink)" ink="var(--paper)" />
        <span className="flex flex-col leading-none">
          <span className="font-display text-[24px] font-bold uppercase tracking-[-0.01em]">Wilber</span>
          <span className="mt-1 text-[13px] font-medium text-ink-soft">Campamento base</span>
        </span>
      </Link>
      <nav aria-label="Panel" className="flex flex-col gap-0.5 px-3">
        {NAV.map((item) => (
          <SideLink key={item.id} item={item} active={item.id === active} badge={item.id === "cruces" ? conflicts : undefined} />
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-0.5 px-3 pb-5">
        <div aria-hidden className="perforation-x mb-2 [--perf:var(--ground)]" />
        {OUTSIDE.map((item) => (
          <SideLink key={item.id} item={item} active={false} />
        ))}
      </div>
    </aside>
  );
}

const noSubscribe = () => () => undefined;

export function TopBar({ title, onSearch, island }: { title: string; onSearch: () => void; island?: ReactNode }) {
  const mac = useSyncExternalStore(noSubscribe, () => /Mac|iPhone|iPad/.test(navigator.platform), () => false);
  return (
    <header className="sticky top-0 z-30 hidden h-[72px] items-center gap-4 bg-ground px-10 lg:flex">
      <h1 className="min-w-0 truncate font-display text-[32px] font-bold uppercase leading-none tracking-[-0.01em] text-ink">{title}</h1>
      <div className="flex flex-1 justify-center">{island}</div>
      <button
        type="button"
        onClick={onSearch}
        className="pressable flex h-11 w-[300px] items-center gap-2.5 rounded-full bg-ink/8 px-4 text-left text-[15px] text-ink-soft select-none hover:bg-ink/12"
      >
        <Search className="size-4.5 shrink-0" aria-hidden />
        <span className="flex-1 truncate">Código, nombre o salida</span>
        <Kbd>{mac ? "⌘K" : "Ctrl K"}</Kbd>
      </button>
      <ThemeButton />
      <SimClock />
    </header>
  );
}

// --- Phone ---------------------------------------------------------------------------

export function MobileHeader({ title, onSearch }: { title: string; onSearch: () => void }) {
  return (
    <header className="sticky top-0 z-30 bg-ground pt-[env(safe-area-inset-top,0px)] lg:hidden">
      <div className="flex h-14 items-center gap-2 px-4">
        <h1 className="min-w-0 flex-1 truncate font-display text-[30px] font-bold uppercase leading-none tracking-[-0.01em] text-ink">{title}</h1>
        <SimClock compact />
        <IconBtn label="Buscar" onClick={onSearch} className="-mr-2">
          <Search className="size-[22px]" />
        </IconBtn>
      </div>
    </header>
  );
}

export function MobileTabBar({ conflicts, moreOpen, onMore }: { conflicts: number; moreOpen: boolean; onMore: () => void }) {
  const pathname = usePathname();
  const route = navIdFor(pathname);
  const active = moreOpen ? "mas" : TAB_IDS.includes(route) ? route : "mas";
  return (
    <div className="fixed inset-x-3 bottom-[max(10px,env(safe-area-inset-bottom,0px))] z-40 select-none lg:hidden">
      <LiquidTabBar
        variant="bar"
        ariaLabel="Panel"
        activeId={active}
        onSelect={(id) => {
          if (id === "mas") onMore();
        }}
        tabs={[
          { id: "hoy", label: "Hoy", href: "/wilber", icon: <Tent /> },
          { id: "salidas", label: "Salidas", href: "/wilber/salidas", icon: <CalendarDays /> },
          { id: "reservas", label: "Reservas", href: "/wilber/reservas", icon: <Ticket /> },
          { id: "cruces", label: "Cruces", href: "/wilber/cruces", icon: <Shuffle />, badge: conflicts || undefined },
          { id: "mas", label: "Más", icon: <Ellipsis /> },
        ]}
      />
    </div>
  );
}

export function MoreSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const pathname = usePathname();
  const active = navIdFor(pathname);
  const rows = [...NAV.filter((n) => !TAB_IDS.includes(n.id)), ...OUTSIDE];
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={["auto"]}
      title="Más"
      className="rounded-t-ticket border-0 bg-paper text-paper-ink [&_h2[id$='-title']]:sr-only"
    >
      <nav aria-label="Más" className="flex flex-col pt-1 pb-[calc(env(safe-area-inset-bottom,0px)+8px)]">
        <ul className="flex flex-col gap-1">
          {rows.map((item) => {
            const Icon = item.icon;
            const on = item.id === active;
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  onClick={() => onOpenChange(false)}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "pressable flex h-14 items-center gap-3.5 rounded-field px-3.5 text-[17px] font-semibold select-none [-webkit-touch-callout:none]",
                    on ? "bg-ink text-paper" : "text-ink hover:bg-ink/8 active:bg-ink/10",
                  )}
                >
                  <Icon className="size-[22px] shrink-0" aria-hidden />
                  <span className="flex-1">{item.label}</span>
                  <ChevronRight className={cn("size-5", on ? "text-paper/70" : "text-ink-soft")} aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex flex-col gap-2 px-1">
          <span className="text-[14px] font-semibold text-ink">Tema</span>
          <ThemeChips />
        </div>
      </nav>
    </BottomSheet>
  );
}
