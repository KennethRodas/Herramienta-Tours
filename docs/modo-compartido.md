# Modo compartido (pruebas entre personas)

Con `NEXT_PUBLIC_DATA_MODE=supabase` todos los visitantes y el panel de Wilber ven los mismos datos, guardados en Supabase. Los mensajes salen de verdad por WhatsApp (Kapso) y correo (Gmail o Resend). El simulador queda apagado.

## Cómo funciona

- **Estado:** una fila en `public.app_state`, con todo el estado en `state jsonb`. Solo el servidor la lee y la escribe, con la service role. RLS está activo y no tiene políticas.
- **Escrituras:** cada acción del sitio o del panel va a `POST /api/sim/accion`. El servidor corre la misma lógica que la simulación y guarda con *compare-and-swap* sobre `rev`. Si dos personas reservan el último cupo a la vez, una gana y la otra recibe «Se acaban de llenar los cupos».
- **Lecturas:** el navegador consulta `GET /api/sim/estado?rev=N` cada 2,5 s (15 s si la pestaña está oculta). Si nada cambió, la respuesta es `204`.
- **Quién ve qué:**
  - Wilber, después del PIN: todo.
  - Un visitante: salidas y cupos, y solo sus propias reservas (por el número con el que entró, o por los códigos que hizo o abrió), su cuenta y sus mensajes.
  - Los códigos de acceso y el PIN nunca salen del servidor.
- **Automatizaciones:** `POST /api/sim/tick` manda los recordatorios de 24 h, la ubicación 2 h antes, la reseña, el resumen de las 6 p. m. y las alertas de cruces. Lo llaman las páginas abiertas cada 20 s.
- **Mensajes reales:**
  - WhatsApp: a números que una persona escribió (al reservar, al entrar o al escribirle al negocio), y a `WILBER_ADMIN_PHONE` los de Wilber.
  - Correo: a correos escritos por una persona; el resumen de las 6 p. m. va a `ADMIN_EMAIL`.
  - Sin Supabase (desarrollo local), el estado vive en `.next/cache/wilber-compartido.json` y ningún mensaje sale.

## Variables (Vercel → Settings → Environment Variables)

| Variable | Valor |
| --- | --- |
| `NEXT_PUBLIC_DATA_MODE` | `supabase` |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Las pone la integración de Supabase en Vercel |
| `NEXT_PUBLIC_WILBER_WHATSAPP` | `56920403095` (número sandbox de Kapso) |
| `NEXT_PUBLIC_WILBER_WHATSAPP_DISPLAY` | `+56 9 2040 3095` |
| `WILBER_ADMIN_PHONE` | WhatsApp de quien hace de Wilber, con código de país (por ejemplo `5037…`) |
| `ADMIN_PIN` | PIN del panel (si falta: `2381`) |
| `SESSION_SECRET` | Texto aleatorio largo, para firmar las sesiones |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Cuenta de Gmail y su contraseña de aplicación (correo sin dominio propio) |
| `ADMIN_EMAIL` | Opcional: correo de Wilber para el resumen de las 6 p. m. |

## Tabla

`supabase/migrations/20261023000000_app_state.sql`. La primera visita crea la fila con las salidas de la temporada y sin reservas.

## WhatsApp sandbox (Kapso)

- El número sandbox solo entrega mensajes a números registrados como *testers*. Cada participante tiene que:
  1. Agregarse en Kapso: WhatsApp › Sandbox › Add Test Number.
  2. Mandar el código desde su WhatsApp al +56 9 2040 3095.
- WhatsApp solo permite mensajes libres dentro de las 24 h siguientes al último mensaje de la persona. Antes de probar, que cada participante le escriba «hola» al número.
- El webhook de Kapso apunta a `https://wilbertours.vercel.app/api/whatsapp/webhook` con el secreto `KAPSO_WEBHOOK_SECRET`.
