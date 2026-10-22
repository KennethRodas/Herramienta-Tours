import type { Metadata } from "next";
import { InstalarScreen } from "@/components/dashboard/screens/instalar";

export const metadata: Metadata = { title: "Instalar la app" };

export default function InstalarPage() {
  return <InstalarScreen />;
}
