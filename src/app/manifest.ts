import type { MetadataRoute } from "next";

// Installed from Wilber's phone ("Agregar a pantalla de inicio") it opens
// straight into his base camp: today's departures, check-in and WhatsApp.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/wilber",
    name: "Wilber · Campamento base",
    short_name: "Wilber",
    description: "Las salidas, reservas, cruces y el WhatsApp de Wilber en una sola app.",
    start_url: "/wilber?origen=app",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#062b8a",
    theme_color: "#062b8a",
    lang: "es-SV",
    categories: ["travel", "business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Hoy", short_name: "Hoy", url: "/wilber", icons: [{ src: "/icons/shortcut-96.png", sizes: "96x96" }] },
      { name: "Reservas", url: "/wilber/reservas", icons: [{ src: "/icons/shortcut-96.png", sizes: "96x96" }] },
      { name: "WhatsApp", url: "/wilber/whatsapp", icons: [{ src: "/icons/shortcut-96.png", sizes: "96x96" }] },
    ],
  };
}
