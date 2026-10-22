import type { Metadata } from "next";
import { SalidasScreen } from "@/components/dashboard/screens/salidas";

export const metadata: Metadata = { title: "Salidas" };

export default function SalidasPage() {
  return <SalidasScreen />;
}
