import type { Metadata } from "next";
import { HoyScreen } from "@/components/dashboard/screens/hoy";

// The /wilber layout's title template only reaches child segments.
export const metadata: Metadata = { title: { absolute: "Hoy · Campamento base" } };

export default function WilberHoyPage() {
  return <HoyScreen />;
}
