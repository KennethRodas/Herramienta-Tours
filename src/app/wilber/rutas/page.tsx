import type { Metadata } from "next";
import { RouteAdmin } from "@/components/map/route-admin";

export const metadata: Metadata = {
  title: "Rutas",
};

export default function RutasPage() {
  return <RouteAdmin />;
}
