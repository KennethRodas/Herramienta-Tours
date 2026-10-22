import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginFlow } from "@/components/account/login-flow";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Entrá con tu WhatsApp para ver tus reservas.",
};

export default function EntrarPage() {
  return (
    <Suspense>
      <LoginFlow />
    </Suspense>
  );
}
