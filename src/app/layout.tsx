import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { Toaster } from "sonner";
import { SimEngineBoot } from "@/components/sim/engine-boot";
import { ServiceWorkerRegistration } from "@/components/pwa/sw-register";
import "./globals.css";

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Wilber · Tours de aventura en El Salvador",
    template: "%s · Wilber, tours de aventura",
  },
  description:
    "Tours de aventura en El Salvador: volcanes, cascadas, lagos y playa. Fechas, precios y reservas en línea.",
  applicationName: "Wilber",
  keywords: ["El Salvador", "tours", "volcán de Santa Ana", "Izalco", "senderismo", "aventura", "reservas"],
  openGraph: {
    type: "website",
    locale: "es_SV",
    siteName: "Wilber · Tours de aventura",
  },
  appleWebApp: {
    capable: true,
    title: "Wilber",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#062b8a" },
    { media: "(prefers-color-scheme: light)", color: "#e6dbc7" },
  ],
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-SV" className={`${barlow.variable} ${barlowCondensed.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh">
        {children}
        <SimEngineBoot />
        <ServiceWorkerRegistration />
        <Toaster
          position="top-center"
          gap={10}
          toastOptions={{
            style: {
              background: "var(--cobalt-800)",
              color: "var(--sand-50)",
              border: "0",
              borderRadius: "0",
              fontFamily: "var(--font-sans)",
              fontSize: "15px",
            },
          }}
        />
      </body>
    </html>
  );
}
