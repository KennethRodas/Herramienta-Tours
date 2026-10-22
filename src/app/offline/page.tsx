import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";

export const metadata = { title: "Sin conexión" };

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-sm">
        <LogoMark className="mx-auto mb-6 size-16" />
        <h1 className="font-display text-5xl font-semibold uppercase">Sin conexión</h1>
        <p className="mt-3 text-[18px]">Esta página no está guardada en el teléfono. Volvé a intentar con señal.</p>
        <Link href="/wilber" className="pressable mt-6 inline-block bg-cobalt-800 px-6 py-3 font-semibold text-sand-50">
          Abrir el panel
        </Link>
      </div>
    </main>
  );
}
