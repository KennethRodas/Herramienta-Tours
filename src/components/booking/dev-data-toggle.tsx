"use client";

import { usePathname } from "next/navigation";

// break-ui toggle: "Demo / Peor caso" at the top of the page, in the flow so it
// never covers the page's own actions. Development builds only; it is chrome,
// not design, so it keeps a plain system look.

export function DevDataToggle({ worst }: { worst: boolean }) {
  const path = usePathname();
  if (process.env.NODE_ENV === "production") return null;
  const seg = (on: boolean) => ({
    padding: "5px 12px",
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
        display: "flex",
        width: "fit-content",
        gap: 2,
        margin: "12px auto 0",
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
