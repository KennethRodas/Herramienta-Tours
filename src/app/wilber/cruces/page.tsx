import type { Metadata } from "next";
import { CrucesScreen } from "@/components/dashboard/screens/cruces";

export const metadata: Metadata = { title: "Cruces" };

export default function CrucesPage() {
  return <CrucesScreen />;
}
