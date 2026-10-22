"use client";

import { usePathname } from "next/navigation";

// break-ui toggle: "Demo / Peor caso" fixed at the bottom centre, above the
// mobile tab bar. Development builds only; it is chrome, not design.

export function DevDataToggle({ worst }: { worst: boolean }) {
  const path = usePathname();
  if (process.env.NODE_ENV === "production") return null;
  const seg = (on: boolean) => ({
    padding: "6px 12px",
    borderRadius: 999,
    background: on ? "#fff" : "transparent",
    color: "#111",
    textDecoration: "none",
    fontWeight: on ? 600 : 400,
  });
  return (
    <nav
      aria-label="Datos de prueba"
      style={{
        position: "fixed",
        left: "50%",
        bottom: "calc(112px + env(safe-area-inset-bottom))",
        transform: "translateX(-50%)",
        zIndex: 90,
        display: "flex",
        gap: 2,
        padding: 3,
        borderRadius: 999,
        background: "#d4d4d4",
        font: "13px system-ui, sans-serif",
      }}
    >
      <a href={path} style={seg(!worst)}>
        Demo
      </a>
      <a href={`${path}?data=peor`} style={seg(worst)}>
        Peor caso
      </a>
    </nav>
  );
}
