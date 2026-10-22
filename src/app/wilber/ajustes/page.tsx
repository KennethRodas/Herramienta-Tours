import type { Metadata } from "next";
import { AjustesScreen } from "@/components/dashboard/screens/ajustes";

export const metadata: Metadata = { title: "Ajustes" };

export default function AjustesPage() {
  return <AjustesScreen />;
}
