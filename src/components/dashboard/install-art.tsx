// Two-ink drawings of each install step: generic phone and browser shapes,
// no screenshots and no third-party marks. The control to tap is printed in
// solid ink with the label knocked out, like a stamped box on a form.

import type { ReactNode } from "react";
import { TICKET_PATH, TRAIL_PATH } from "@/components/brand/logo";

const T = { fontFamily: "var(--font-sans)", fontWeight: 600 } as const;

function Phone({ children, label }: { children: ReactNode; label: string }) {
  return (
    <svg viewBox="0 0 200 300" role="img" aria-label={label} className="h-auto w-full max-w-[200px]">
      <rect x="6" y="4" width="188" height="292" rx="26" className="fill-paper stroke-ink" strokeWidth="4" />
      <rect x="76" y="14" width="48" height="12" rx="6" className="fill-ink" />
      {children}
    </svg>
  );
}

function Lines({ y = 62 }: { y?: number }) {
  return (
    <g className="fill-ink" opacity="0.14">
      <rect x="24" y={y} width="120" height="12" rx="6" />
      <rect x="24" y={y + 22} width="152" height="7" rx="3.5" />
      <rect x="24" y={y + 36} width="140" height="7" rx="3.5" />
      <rect x="24" y={y + 50} width="150" height="7" rx="3.5" />
      <rect x="24" y={y + 72} width="152" height="54" rx="6" />
    </g>
  );
}

function AppIcon({ x, y, size = 40 }: { x: number; y: number; size?: number }) {
  const k = size / 64;
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <rect width="64" height="64" rx="14" className="fill-ink" />
      <path d={TICKET_PATH} className="fill-paper" transform="translate(8 8) scale(0.75)" />
      <path d={TRAIL_PATH} fill="none" className="stroke-ink" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" transform="translate(8 8) scale(0.75)" />
    </g>
  );
}

/** iPhone: Share icon in Safari's bottom bar. */
export function IosShare() {
  return (
    <Phone label="Safari con el botón Compartir marcado en la barra de abajo">
      <rect x="22" y="36" width="156" height="16" rx="8" className="fill-ink" opacity="0.1" />
      <Lines />
      <rect x="10" y="244" width="180" height="1.5" rx="0.75" className="fill-ink" opacity="0.2" />
      <g className="stroke-ink" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M30 262l-6 6 6 6" />
        <path d="M58 262l6 6-6 6" />
        <path d="M134 264h12M140 258v16" opacity="0.6" />
        <rect x="160" y="259" width="16" height="16" rx="3" opacity="0.6" />
      </g>
      <circle cx="100" cy="268" r="19" className="fill-ink" />
      <g className="stroke-paper" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M92 265v12h16v-12" />
        <path d="M100 271v-15M95 260l5-5 5 5" />
      </g>
    </Phone>
  );
}

/** iPhone: "Agregar a inicio" row in the share sheet. */
export function IosAddRow() {
  const rows = ["Copiar", "Agregar a favoritos", "Agregar a inicio", "Buscar en la página"];
  return (
    <Phone label="Hoja de Compartir con la fila Agregar a inicio marcada">
      <Lines y={50} />
      <rect x="10" y="108" width="180" height="182" rx="18" className="fill-paper stroke-ink" strokeWidth="2" />
      <rect x="86" y="116" width="28" height="4" rx="2" className="fill-ink" opacity="0.3" />
      {rows.map((r, i) => {
        const on = i === 2;
        const y = 132 + i * 38;
        return (
          <g key={r}>
            <rect x="18" y={y} width="164" height="32" rx="6" className="fill-ink" opacity={on ? 1 : 0.07} />
            <text x="30" y={y + 21} style={T} fontSize="12" className={on ? "fill-paper" : "fill-ink"}>
              {r}
            </text>
            {on ? (
              <g className="stroke-paper" strokeWidth="2.4" fill="none" strokeLinecap="round">
                <rect x="156" y={y + 8} width="16" height="16" rx="4" />
                <path d={`M164 ${y + 12}v8M160 ${y + 16}h8`} />
              </g>
            ) : null}
          </g>
        );
      })}
    </Phone>
  );
}

/** iPhone: confirm with "Agregar". */
export function IosConfirm() {
  return (
    <Phone label="Pantalla Agregar a inicio con el botón Agregar marcado">
      <text x="22" y="52" style={T} fontSize="12" className="fill-ink" opacity="0.7">
        Cancelar
      </text>
      <text x="100" y="52" style={T} fontSize="12" textAnchor="middle" className="fill-ink">
        Agregar a inicio
      </text>
      <rect x="138" y="36" width="48" height="24" rx="12" className="fill-ink" />
      <text x="162" y="52" style={T} fontSize="11.5" textAnchor="middle" className="fill-paper">
        Agregar
      </text>
      <rect x="18" y="76" width="164" height="64" rx="10" className="fill-ink" opacity="0.07" />
      <AppIcon x={28} y={86} size={44} />
      <text x="84" y="104" style={T} fontSize="14" className="fill-ink">
        Wilber
      </text>
      <rect x="84" y="112" width="84" height="6" rx="3" className="fill-ink" opacity="0.15" />
      <g className="fill-ink" opacity="0.1">
        <rect x="18" y="156" width="164" height="7" rx="3.5" />
        <rect x="18" y="170" width="130" height="7" rx="3.5" />
      </g>
    </Phone>
  );
}

/** Android: Chrome's ⋮ menu. */
export function AndroidMenu() {
  return (
    <Phone label="Chrome en Android con el menú de tres puntos marcado">
      <rect x="18" y="36" width="134" height="22" rx="11" className="fill-ink" opacity="0.1" />
      <circle cx="172" cy="47" r="15" className="fill-ink" />
      <g className="fill-paper">
        <circle cx="172" cy="40" r="2.4" />
        <circle cx="172" cy="47" r="2.4" />
        <circle cx="172" cy="54" r="2.4" />
      </g>
      <Lines y={74} />
    </Phone>
  );
}

/** Android: "Instalar app" in the menu. */
export function AndroidInstallItem() {
  const items = ["Nueva pestaña", "Historial", "Descargas", "Instalar app", "Configuración"];
  return (
    <Phone label="Menú de Chrome con la opción Instalar app marcada">
      <Lines y={74} />
      <rect x="66" y="34" width="122" height="178" rx="8" className="fill-paper stroke-ink" strokeWidth="2" />
      {items.map((t, i) => {
        const on = i === 3;
        const y = 42 + i * 33;
        return (
          <g key={t}>
            {on ? <rect x="70" y={y} width="114" height="28" rx="4" className="fill-ink" /> : null}
            <text x="80" y={y + 18.5} style={T} fontSize="11.5" className={on ? "fill-paper" : "fill-ink"} opacity={on ? 1 : 0.75}>
              {t}
            </text>
          </g>
        );
      })}
    </Phone>
  );
}

/** Android: confirm with "Instalar". */
export function AndroidConfirm() {
  return (
    <Phone label="Diálogo Instalar app con el botón Instalar marcado">
      <Lines y={50} />
      <rect x="0" y="0" width="200" height="300" rx="26" className="fill-ink" opacity="0.18" />
      <rect x="20" y="96" width="160" height="124" rx="12" className="fill-paper stroke-ink" strokeWidth="2" />
      <text x="34" y="122" style={T} fontSize="13" className="fill-ink">
        ¿Instalar app?
      </text>
      <AppIcon x={34} y={134} size={30} />
      <text x="74" y="154" style={T} fontSize="12" className="fill-ink">
        Wilber
      </text>
      <text x="108" y="202" style={T} fontSize="11.5" textAnchor="end" className="fill-ink" opacity="0.7">
        Cancelar
      </text>
      <rect x="116" y="186" width="56" height="24" rx="12" className="fill-ink" />
      <text x="144" y="202" style={T} fontSize="11" textAnchor="middle" className="fill-paper">
        Instalar
      </text>
    </Phone>
  );
}

function Browser({ children, label }: { children: ReactNode; label: string }) {
  return (
    <svg viewBox="0 0 320 180" role="img" aria-label={label} className="h-auto w-full max-w-[320px]">
      <rect x="4" y="4" width="312" height="172" rx="10" className="fill-paper stroke-ink" strokeWidth="4" />
      <rect x="16" y="14" width="88" height="18" rx="5" className="fill-ink" opacity="0.12" />
      {children}
    </svg>
  );
}

/** Desktop: install icon at the end of the address bar. */
export function DesktopBar() {
  return (
    <Browser label="Barra de direcciones con el ícono de instalar marcado">
      <rect x="16" y="40" width="288" height="26" rx="13" className="fill-ink" opacity="0.1" />
      <text x="32" y="57" style={T} fontSize="11.5" className="fill-ink" opacity="0.75">
        tu-sitio/wilber
      </text>
      <circle cx="286" cy="53" r="15" className="fill-ink" />
      <g className="stroke-paper" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <rect x="277" y="45" width="18" height="12" rx="2" />
        <path d="M282 61h8M286 48v6M283 51l3 3 3-3" />
      </g>
      <g className="fill-ink" opacity="0.12">
        <rect x="16" y="82" width="140" height="12" rx="6" />
        <rect x="16" y="104" width="288" height="7" rx="3.5" />
        <rect x="16" y="118" width="250" height="7" rx="3.5" />
        <rect x="16" y="132" width="270" height="7" rx="3.5" />
      </g>
    </Browser>
  );
}

/** Desktop: confirm with "Instalar". */
export function DesktopConfirm() {
  return (
    <Browser label="Diálogo de instalación con el botón Instalar marcado">
      <rect x="16" y="40" width="288" height="26" rx="13" className="fill-ink" opacity="0.1" />
      <rect x="150" y="70" width="156" height="96" rx="8" className="fill-paper stroke-ink" strokeWidth="2" />
      <text x="162" y="92" style={T} fontSize="12" className="fill-ink">
        ¿Instalar app?
      </text>
      <AppIcon x={162} y={102} size={24} />
      <text x="194" y="118" style={T} fontSize="11" className="fill-ink">
        Wilber
      </text>
      <rect x="236" y="134" width="60" height="22" rx="11" className="fill-ink" />
      <text x="266" y="149" style={T} fontSize="11" textAnchor="middle" className="fill-paper">
        Instalar
      </text>
      <text x="196" y="149" style={T} fontSize="11" textAnchor="middle" className="fill-ink" opacity="0.7">
        Cancelar
      </text>
    </Browser>
  );
}
