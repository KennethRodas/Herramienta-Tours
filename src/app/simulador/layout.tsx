import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Simulador",
  description: "Reloj, escenarios, tráfico simulado, WhatsApp y correos de la simulación de reservas.",
  robots: { index: false },
};

export default function SimuladorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="noche" className="field-ink min-h-dvh">
      {children}
    </div>
  );
}
