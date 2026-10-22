import type { Metadata } from "next";
import { MapExplorer } from "@/components/map/explorer";

export const metadata: Metadata = {
  title: "Mapa",
  description: "Mapa 3D con la ruta de cada aventura: volcanes, cascadas, lagos y costa de El Salvador.",
};

export default async function MapaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { tour } = await searchParams;
  return <MapExplorer initialSlug={typeof tour === "string" ? tour : undefined} />;
}
