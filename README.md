# Tours de Aventura de Wilber

Reservas de tours de aventura en El Salvador y panel de operación para Wilber, un guía que hoy reserva por WhatsApp, cuaderno y memoria. En temporada alta se le cruzaban grupos: un cruce le costó $120 en guía y transporte.

- Sitio: https://wilbertours.vercel.app
- Proyecto del curso «El Camino Emprendedor», semana 9, equipo *losquefaltan* (story map y PRD en `S9-*.json`).

## Qué hace

**Visitantes** (`/`, `/aventuras`, `/aventuras/[tour]`, `/salidas/[id]`, `/reserva/[código]`)
- Catálogo con duración, dificultad, precio y descripción; filtro por dificultad; avisos cuando no hay tours o el filtro no tiene resultados.
- Fechas futuras con horario y cupos; las llenas se ven pero no se eligen. Detalle de salida con punto de encuentro y cupos en vivo.
- Reserva en pasos: grupo (con cupos apartados 10 minutos), datos, resumen editable y confirmación. No permite reservar más cupos de los que hay.
- Boleto con código, QR, hora de llegada, punto de encuentro en mapa, qué llevar, clima, calendario y botón a WhatsApp.
- Mapa 3D con relieve real y recorrido animado de cada ruta (`/mapa`).

**Wilber** (`/wilber`, app instalable)
- Hoy: salida en curso, lista con llegada de cada grupo, clima y alertas.
- Salidas (calendario), reservas (tabla y reserva manual), cruces de guía y microbús con arreglo en un clic, números, rutas, ajustes.
- WhatsApp (`/wilber/whatsapp`): bot de comandos (`hoy`, `semana`, `lista SA24`, `cruces`, `caja`, `llegó WIL-XXXX`…) y mensajes automáticos.
- Guía para instalarla en el teléfono (`/wilber/instalar`). PIN de la simulación: `2381`.

**Simulador** (`/simulador`)
- Reloj simulado (pausa, ×60, ×600, ×3600, saltos y fecha exacta), tráfico de visitantes, escenarios (carrera por los últimos cupos, Semana Santa, cruce de guía, tormenta, catálogo vacío, falla de WhatsApp, pago rechazado).
- Los 16 criterios de aceptación del story map, cada uno con un botón que prepara el caso y abre la página donde se ve.
- Teléfono del visitante, teléfono de Wilber, bandeja de correos con las plantillas reales, registro de eventos y números (sobreventas: siempre 0).
- Todo corre en el navegador y se sincroniza entre pestañas: abrí el sitio, el panel y el simulador a la vez.

## Cómo evita la sobreventa

- Simulación: cada reserva pasa por un Web Lock del navegador y vuelve a leer el estado antes de escribir; pestañas o bots simultáneos quedan en fila.
- Supabase: la función `create_booking` bloquea la fila de la salida (`FOR UPDATE`) antes de contar cupos. Probado en PostgreSQL 15 con 10 reservas simultáneas por 4 cupos durante 30 rondas: siempre 4 aceptadas y 6 rechazadas.

## Correr local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Sin variables corre completo en modo simulación. Íconos: `node scripts/generate-icons.mjs`. Semilla SQL: `node scripts/generate-seed.mjs`.

## Integraciones

| Servicio | Estado | Variables |
| --- | --- | --- |
| WhatsApp (Kapso) | Webhook creado hacia `/api/whatsapp/webhook`; envío real solo a números de prueba | `KAPSO_API_KEY`, `KAPSO_PHONE_NUMBER_ID`, `KAPSO_WEBHOOK_SECRET`, `WHATSAPP_TEST_NUMBERS`, `WILBER_ADMIN_PHONE` |
| Pagos (Wompi El Salvador) | Pendiente de llaves. Registrar redirect y webhook | `WOMPI_CLIENT_ID`, `WOMPI_CLIENT_SECRET` |
| Correo (Resend) | Plantillas listas; envío real solo a correos de prueba | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_TEST_ADDRESSES` |
| Base de datos (Supabase) | Esquema, RLS, funciones y realtime en `supabase/` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Clima (Open-Meteo) | Activo, sin llave | — |
| Mapas (OpenFreeMap, relieve AWS, Esri) | Activo, sin llave | — |

URLs para registrar: `docs/integraciones/urls.md`. Referencias: `docs/integraciones/kapso.md`, `docs/integraciones/wompi.md`, `supabase/README.md`.

**Probar WhatsApp real:** en Kapso, WhatsApp › Sandbox › Add Test Number y mandar el código desde tu teléfono; agregar tu número a `WHATSAPP_TEST_NUMBERS` en Vercel; en `/simulador` escribir el número y encender el envío real. Llegan por WhatsApp los avisos de Wilber y la confirmación de cualquier reserva hecha con tu número (los clientes simulados no). Con «Contestar con el bot», lo que escribas al número sandbox (`hoy`, `cruces`…) lo responde el bot con los datos de la simulación.

**Pendiente para producción:** conectar la interfaz a Supabase (hoy la interfaz lee la simulación; el modo `NEXT_PUBLIC_DATA_MODE=supabase` activa el bot de WhatsApp con datos reales), login de Wilber con Supabase Auth, plantillas de WhatsApp aprobadas por Meta para mensajes fuera de la ventana de 24 h, y llaves de Wompi.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · Motion · GSAP · Lenis · MapLibre GL · React Email · Supabase · Kapso · Resend · Wompi. Tipografía Barlow. Componentes de [beui.dev](https://beui.dev) y la barra «Liquid Glass» (MIT). Detalle en `THIRD_PARTY_NOTICES.md`.

Contenido de muestra (precios, horarios, guías, vehículos, rutas) para que Wilber lo confirme antes de publicar.
