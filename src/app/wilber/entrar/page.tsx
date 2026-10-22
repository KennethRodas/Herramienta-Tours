import type { Metadata } from "next";
import { EntrarScreen } from "@/components/dashboard/screens/entrar";

export const metadata: Metadata = { title: "Entrar" };

export default async function EntrarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const volver = typeof sp.volver === "string" ? sp.volver : undefined;
  return <EntrarScreen volver={volver} />;
}
