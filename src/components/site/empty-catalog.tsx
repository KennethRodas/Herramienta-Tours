import { ButtonLink } from "@/components/ui/button";
import { BUSINESS } from "@/content/catalog";
import { waLink } from "@/lib/domain/format";
import { cn } from "@/lib/utils";

/** Empty catalog (PRD): what happened, and the one way to resolve it. */
export function EmptyCatalog({ className, align = "center" }: { className?: string; align?: "center" | "start" }) {
  return (
    <div role="status" className={cn("flex flex-col gap-5 py-10", align === "center" ? "items-center text-center" : "items-start", className)}>
      <p className="text-body font-semibold">No hay aventuras disponibles por ahora.</p>
      <ButtonLink
        href={waLink(BUSINESS.whatsapp, "Hola Wilber, ¿cuándo hay salidas?")}
        target="_blank"
        rel="noopener noreferrer"
      >
        Escribir a Wilber por WhatsApp
      </ButtonLink>
    </div>
  );
}
