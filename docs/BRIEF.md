# Brief de construcción — Tours de Aventura de Wilber

Este documento es el contrato para todo agente que trabaje en el repo. Leelo completo antes de tocar código.

## 0. Qué es y para quién

- **Cliente:** Wilber, guía de aventura en El Salvador. Opera solo o con 2 guías y 2 microbuses de 14 asientos. Hoy reserva por WhatsApp, cuaderno y memoria.
- **Problema real (del canvas del curso):** en temporada alta se le cruzan grupos (mismo guía o mismo microbús en dos salidas). Un cruce le costó $120 en guía y transporte.
- **Usuarios:** (1) visitantes que reservan cupos para su grupo en una salida con fecha; (2) Wilber, que opera todo y quiere poder hacerlo desde WhatsApp.
- **Contexto:** es un concepto para una presentación de curso. **Todo funciona en modo simulación, sin claves.** Supabase, Kapso (WhatsApp), Resend (correo) y Wompi (pagos) se activan con variables de entorno.
- Historias y criterios de aceptación: `S9-story_map-losquefaltan.json` y `S9-ai_design-losquefaltan.json` en la raíz. Cada criterio debe poder demostrarse en la UI.

## 1. Reglas de texto (exigencia explícita del usuario)

El usuario odia el relleno. Escribí como un boleto o un itinerario impreso:

- Solo datos útiles: fecha, hora, precio, lugar, duración, distancia, desnivel, qué llevar, cupos, qué hace un botón.
- **Prohibido:** slogans, taglines, frases como «cupos reales», «experiencias inolvidables», «aventura única», adjetivos de marketing, saludos, descripciones poéticas, texto que repite lo obvio, información extra que nadie pidió.
- Si una oración se puede borrar sin perder información, se borra.
- Títulos = etiquetas («Próximas salidas», «Aventuras», «Qué llevar»), no frases.
- Español de El Salvador con voseo («Reservá», «Elegí», «Escribí»). Sin emoji.
- Estados vacíos y errores: una oración que dice qué pasó + la acción para resolverlo.

## 2. Sistema visual

**Dirección (taste-skill):** «la página es el objeto». El sitio se construye como la papelería de Wilber: boletos, tiras de boletos, hojas de itinerario con corte en zigzag, fichas con pestaña, tarjetas. Hoja de dirección completa: `.taste-skill/direction.json` (repartida por `draw.mjs`), con estas correcciones del usuario: **paleta cobalto sobre arena y tipografía Barlow** (la verde y dorada y STIX fueron rechazadas).

**Idea:** cada salida es una tira de boletos de papel, uno por asiento del microbús. Cada reserva arranca boletos de la tira; lo que queda es la disponibilidad. Componente base: `src/components/booking/boleto-strip.tsx`.

**Paleta (tokens en `src/app/globals.css`, nunca hex sueltos):**
- Fondo arena `bg-ground` (#e6dbc7), tinta cobalto `text-ink` (#062b8a), tinta suave `text-ink-soft`.
- Papel claro para objetos: clase `.paper` (sand-50). Campo invertido: clase `.field-ink` (cobalto con texto arena).
- Escalas: `sand-50…400`, `cobalt-950…200`. `text-stamp`/`bg-stamp` (rojo sello) **solo** para «Lleno», errores y sellos.
- Tokens shadcn (`bg-background`, `text-foreground`, `bg-muted`, `border-border`, `bg-primary`…) ya mapeados: los componentes de beui adoptan la paleta solos, y dentro de `.field-ink` se invierten.

**Tipografía:** `font-sans` = Barlow (texto e interfaz). `font-display` = Barlow Condensed (títulos, números grandes, códigos de boleto). Mayúsculas permitidas en títulos display y en etiquetas de boleto ≥ 14px. Pasos: `text-small`, `text-body`, `text-lead`, `text-head`, `text-display` (máximo 5 tamaños por página). Cifras alineadas: clase `tabular`.

**Utilidades de papel:** `.edge-scallop-b/-t/-y`, `.edge-zigzag-b`, `.ticket-notch` (muescas laterales), `.ticket-notch-x` (muescas para talón, `--nx`), `.perforation-x/-y` (línea de puntos para arrancar), `.dot-leader`, `.stamp`, `.print-corners` (radios a 0 para beui dentro de objetos impresos), `.pressable` (feedback al presionar).

**Reglas de la casa (taste-skill, se verifican con `lint.mjs`/`inspect.mjs`):** sin degradados, sin sombras en reposo, sin líneas finas ni cajas con borde de 1px (salvo campos de formulario y tablas), sin «eyebrows» ni píldoras sobre títulos, sin numeración 01/02/03, sin tarjetas con ícono arriba en fila, sin palabra destacada en otro color/estilo dentro de un título, sin emoji, sin monoespaciada, títulos de 2 líneas máximo en todo ancho. **Vidrio:** solo la barra Liquid Glass que entregó el usuario (`LiquidTabBar`).

**Imágenes:** 14 fotos reales CC BY-SA en `public/images/places/<slug>.jpg` (1800px) y `<slug>-sm.jpg` (640px), metadatos en `src/content/photo-credits.ts` (`PHOTO_CREDITS[slug]`, incluye `credit`). Usá `next/image`. Toda foto usada debe tener su crédito visible (pie corto o lista en el footer + página `/creditos`). Nunca presentarlas como fotos de Wilber o de sus grupos. `juayua` es vertical.

**Movimiento:** GSAP 3.15 (`gsap`, `gsap/ScrollTrigger`, `gsap/SplitText`, `@gsap/react` → `useGSAP`) para entradas y scroll; Motion (`motion/react`) para resortes de componentes; Lenis para scroll suave en el sitio público. Reglas de Emil Kowalski: curvas `var(--ease-out)`/`var(--ease-in-out)`/`var(--ease-drawer)`, interfaz ≤ 300 ms, presionar = `scale(0.97)`, nunca desde `scale(0)`, popovers con origen en el disparador, solo `transform`/`opacity`, todo con alternativa `prefers-reduced-motion`. Feedback visual en cada botón, campo y control (hover, focus, presionado, cargando, éxito, error).

**Skills a cargar con la herramienta Skill:** `emil-design-eng` (todos los que hacen UI), `taste-skill` (sitio público), `apple-design` y `mobile-native` (panel/PWA), `dataviz` (gráficos), `animate` (movimiento nuevo), `break-ui` (pruebas de casos extremos).

## 3. Técnica

- **Next.js 16.4 App Router + Turbopack. No es el Next que conocés:** leé `node_modules/next/dist/docs/` ante cualquier duda. `params` y `searchParams` son Promesas (`PageProps<'/ruta/[x]'>`). `middleware` ahora es `proxy.ts`. `next lint` no existe (`npx eslint <archivos>`). `cacheComponents` está apagado.
- **Tailwind v4** (CSS-first). **No edites `src/app/globals.css`**: si necesitás un token, pedilo al lead en tu reporte. CSS propio va en el componente.
- **Dependencias ya instaladas** (no instales nada; si de verdad falta algo, detenete y reportalo): next, react 19.3, motion, gsap, @gsap/react, lenis, maplibre-gl, @supabase/supabase-js, @supabase/ssr, resend, @react-email/components, @react-email/render, zod, sonner, lucide-react, clsx, tailwind-merge, @floating-ui/dom, @tanstack/react-virtual, qrcode, date-fns, canvas-confetti.
- **Verificación:** `npx tsc --noEmit -p .` y `npx eslint <tus archivos>` deben pasar. **No corras `next build` ni otro `next dev`**: ya hay uno en http://localhost:3000 (si tenés herramientas de navegador, usalo para mirar tu trabajo; si no, el lead hace la revisión visual).
- **Componentes beui** (MIT, beui.dev) en `src/components/motion/*` y `src/components/charts/*`: botones (base/stateful/magnetic), hold-action-button, slide-action-button, expanding-arrow-button, input, select, combobox, checkbox, radio, switch, adaptive-stepper, wheel-picker, range-slider, date-range-picker, otp-input, tabs, morphing-tabs, expandable-tabs, bottom-sheet, drawer, morphing-modal, center-morph-modal, popover, popover-morph, tooltip, context-menu, command-palette, morphing-search, notification-stack, dynamic-island, animated-toast-stack, swipeable-list, pull-to-refresh, table, timeline, bouncy-accordion, collapsible, alert, animated-badge, number-ticker, animated-number, digit-swap, text-reveal, text-scramble, text-shimmer, action-swap-*, marquee, tilt-card, card, morphing-lightbox, file-upload, feedback-widget, availability-scheduler, bloom-menu, overflow-actions, expandable-action-bar, animated-sidebar, shared-layout-bg, loader, scroll-progress, scroll-reveal, parallax, smooth-scroll, not-found/stacked, charts: donut, heat-calendar, funnel. Usalos y adaptalos con `className`; no reescribas archivos de beui salvo un bug (y anotalo).
- **Compartidos de solo lectura** (pedí cambios al lead): `src/lib/**`, `src/content/**`, `src/components/brand/**`, `src/components/nav/**`, `src/components/ui/**`, `src/app/layout.tsx`, `src/app/globals.css`.

### Datos y simulación (`src/lib/sim`, `src/lib/domain`)

Todo componente que lee datos vivos es `"use client"`. En el servidor y durante la hidratación los hooks devuelven `null`/`undefined`: renderizá el esqueleto estático (los tours salen de `TOURS`, con buen SEO) y llená lo vivo después.

- Hooks (`@/lib/sim/hooks`): `useSimState`, `useHydrated`, `useNow(ms)` (hora simulada), `useTours({includeInactive?})`, `useTourDepartures(tourId)` (solo futuras, con `.left` y `.state`), `useDeparture(id)` (`undefined` cargando, `null` no existe), `useDepartures(filter?)`, `useNextDepartures()`, `useBookingByCode(code)`, `useBookings(filter?)`, `useMessages(filter?)`, `useEvents(limit)`, `useConflicts()`, `useSettings()`, `useStats()`, `useClock()`, `useSessionId()`.
- Acciones (`sim` de `@/lib/sim/store`, todas async y serializadas con Web Locks entre pestañas): `book(input)` → `BookingResult`, `hold(depId, n, sessionId, prevHoldId?)`, `releaseHold`, `settlePayment(bookingId, 'aprobar'|'rechazar')`, `cancelBooking`, `checkIn(id, n?)`, `markNoShow`, `createDeparture`, `updateDeparture`, `cancelDeparture(id, motivo)`, `fillDeparture(id, dejar)`, `applyFix(conflictId)`, `assign`, `setTourOverride`, `wilberSays(texto)`, `customerSays(tel, texto)`, `updateSettings`, `setClock`, `reset(seed?)`.
- Dominio (`@/lib/domain/*`): tipos (`types.ts`), formato y zona horaria de El Salvador (`format.ts`: `formatDayShort`, `formatDayLong`, `formatTime`, `formatUsd`, `formatDuration`, `formatCountdown`, `formatRelativeDay`, `waLink`…), disponibilidad (`availability.ts`: `seatsLeft`, `departureState`, `DEPARTURE_STATE_LABEL`, `isBookable`, `validateBooking`, `HOLD_MS`, `BOOKING_CUTOFF_MS`), cruces (`conflicts.ts`), referencias de salida tipo `SA24` (`refs.ts`), clima simulado y real Open-Meteo (`weather.ts`).
- Contenido (`@/content/catalog`): `TOURS`, `MEETING_POINTS`, `GUIDES`, `VEHICLES`, `BUSINESS`, `DIFFICULTY_LABEL`, `DIFFICULTY_NOTE`, `DIFFICULTY_ORDER`, helpers `tourBySlug`, `tourById`, `meetingPointById`…
- WhatsApp (`@/lib/whatsapp/*`): plantillas, bot de comandos de Wilber (`handleAdminMessage`), bot de clientes.

### Piezas compartidas listas

- `LogoMark`, `Wordmark` (`@/components/brand/logo`).
- `LiquidTabBar` (`@/components/nav/liquid-tabbar`): `variant="bar"` (barra inferior con íconos) o `"segmented"` (selector de texto, p. ej. filtro de dificultad). Props: `tabs`, `activeId`, `onSelect`, `href` por pestaña.
- `Button`, `ButtonLink`, `buttonClass` (`@/components/ui/button`): bloque plano, esquinas rectas; variantes `primary`, `quiet`, `inverse`, `stamp`.
- `BoletoStrip` (`@/components/booking/boleto-strip`).
- Mapa (`@/components/map`): `TerrainMap`, `RouteMap`, `MeetingPointMap`, `RouteEditor` — hoy son placeholders con la API final; el agente de mapas los reemplaza.
- Correo (`@/emails/render`): contrato `renderEmail(kind, data)`.

## 4. Rutas y dueños

| Dueño | Archivos |
| --- | --- |
| **SITIO** | `src/app/(sitio)/layout.tsx` (cabecera, barra Liquid Glass móvil, footer, Lenis), `src/app/(sitio)/page.tsx` (portada), `src/app/(sitio)/aventuras/page.tsx` (catálogo + filtro + vacíos), `src/app/(sitio)/creditos/page.tsx`, `src/app/not-found.tsx`, `src/components/site/**`. Borra `src/app/page.tsx` (placeholder). |
| **RESERVA** | `src/app/(sitio)/aventuras/[slug]/page.tsx`, `src/app/(sitio)/salidas/[id]/page.tsx`, `src/app/(sitio)/reserva/page.tsx`, `src/app/(sitio)/reserva/[codigo]/page.tsx`, `src/app/(sitio)/reserva/pago/page.tsx`, `src/app/(sitio)/reserva/pago/retorno/page.tsx`, `src/components/booking/**`, `src/emails/**`. |
| **PANEL** | `src/app/wilber/**` excepto `wilber/whatsapp/**` y `wilber/rutas/**`; `src/components/dashboard/**`. |
| **MAPA** | `src/components/map/**`, `src/app/(sitio)/mapa/page.tsx`, `src/app/wilber/rutas/page.tsx`. |
| **LEAD** | `src/app/simulador/**`, `src/components/sim/**`, `src/components/whatsapp/**`, `src/app/wilber/whatsapp/**`, `src/app/api/**`, `src/lib/**`, `supabase/**`, `docs/**`, PWA (`manifest.ts`, `public/sw.js`, `/offline`). |

No edites archivos de otro dueño. Si necesitás algo de otro, usá su API pública; si no existe, dejalo con un placeholder honesto y anotalo en tu reporte.

Rutas fijas que los demás enlazan: `/`, `/aventuras`, `/aventuras/[slug]`, `/salidas/[id]`, `/reserva`, `/reserva/[codigo]`, `/reserva/pago?reserva=<bookingId>`, `/reserva/pago/retorno`, `/mapa`, `/creditos`, `/wilber`, `/wilber/salidas`, `/wilber/reservas`, `/wilber/cruces`, `/wilber/numeros`, `/wilber/rutas`, `/wilber/whatsapp`, `/wilber/ajustes`, `/wilber/instalar`, `/wilber/entrar`, `/simulador`.

## 5. Reporte final (máximo 25 líneas)

Archivos creados, qué historias/criterios cubre cada pantalla, componentes beui usados, qué quedó pendiente o con placeholder, pedidos al lead (tokens, cambios en `src/lib`), y el resultado de `tsc` y `eslint`.
