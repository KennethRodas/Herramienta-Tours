import type { Metadata } from "next";
import { AccountView } from "@/components/account/account-view";

export const metadata: Metadata = {
  title: "Mi cuenta",
  description: "Tus reservas y tus datos.",
  robots: { index: false },
};

export default function CuentaPage() {
  return <AccountView />;
}
