import type { Metadata } from "next";
import { NumerosScreen } from "@/components/dashboard/screens/numeros";

export const metadata: Metadata = { title: "Números" };

export default function NumerosPage() {
  return <NumerosScreen />;
}
