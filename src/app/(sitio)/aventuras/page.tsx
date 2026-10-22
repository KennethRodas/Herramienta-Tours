import type { Metadata } from "next";
import { Catalog, type CatalogFilter } from "@/components/site/catalog";
import { DIFFICULTY_ORDER } from "@/content/catalog";

export const metadata: Metadata = {
  title: "Aventuras",
  description: "Tours de aventura en El Salvador con duración, dificultad, precio por persona y próxima salida con cupos.",
};

function parseFilter(value: string | string[] | undefined): CatalogFilter {
  const v = Array.isArray(value) ? value[0] : value;
  return DIFFICULTY_ORDER.find((d) => d === v) ?? "todas";
}

export default async function AventurasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { dificultad } = await searchParams;
  const initial = parseFilter(dificultad);
  return <Catalog key={initial} initialFilter={initial} />;
}
