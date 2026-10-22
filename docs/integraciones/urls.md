# URLs de integración — wilbertours.vercel.app

| Servicio | Para qué | URL | Estado |
| --- | --- | --- | --- |
| Kapso | Webhook `whatsapp.message.received` (número sandbox `597907523413541`) | `https://wilbertours.vercel.app/api/whatsapp/webhook` | Creado el 22/10/2026 (id `0d870a32-7ba7-4108-9190-e3934f2eaa05`), firmado con `KAPSO_WEBHOOK_SECRET` |
| Wompi | Redirect después de pagar (`configuracion.urlRedirect`) | `https://wilbertours.vercel.app/reserva/pago/retorno` | Pendiente: registrar en el Panel de Wompi |
| Wompi | Webhook de transacciones («Notifica via Webhook» / `configuracion.urlWebhook`) | `https://wilbertours.vercel.app/api/pagos/wompi/webhook` | Pendiente: registrar en el Panel de Wompi |
| Wompi | Botón «atrás» de la pasarela (`configuracion.urlRetorno`) | `https://wilbertours.vercel.app/reserva` | Se envía al crear cada enlace |
| Sitio | Estado de integraciones (sin secretos) | `https://wilbertours.vercel.app/api/estado` | — |

## Variables de entorno en Vercel

| Variable | Valor |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://wilbertours.vercel.app` |
| `KAPSO_API_KEY` | la llave de Kapso |
| `KAPSO_PHONE_NUMBER_ID` | `597907523413541` (sandbox) |
| `KAPSO_WEBHOOK_SECRET` | el secreto del webhook (está en `.env.local`, no se sube a git) |
| `WHATSAPP_TEST_NUMBERS` | números que pueden recibir mensajes reales del simulador, con 503, separados por coma |
| `WILBER_ADMIN_PHONE` | WhatsApp de Wilber (sus mensajes reciben el bot de comandos) |
| `WOMPI_CLIENT_ID`, `WOMPI_CLIENT_SECRET` | cuando Wompi entregue las llaves |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_TEST_ADDRESSES` | para correos reales |
| `NEXT_PUBLIC_DATA_MODE` | `simulacion` (por defecto) o `supabase` |

Después de cambiar variables en Vercel hay que volver a desplegar.
