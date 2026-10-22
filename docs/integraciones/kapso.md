# Kapso: referencia de integración (WhatsApp Cloud API)

Investigado el 2026-10-22 a partir de https://docs.kapso.ai/llms.txt y de las páginas .md enlazadas en cada sección.

Convenciones:
- **SIN CONFIRMAR**: no aparece en la documentación revisada, o es una inferencia propia.
- Los valores `<...>` son placeholders. Este archivo no contiene API keys: usa la variable de entorno `KAPSO_API_KEY`.
- Cada bloque JSON indica si es literal de la página o está reconstruido a partir de los campos documentados.

## Resumen para Herramienta-Tours
- Confirmaciones y recordatorios de reserva fuera de la ventana de 24 h requieren plantilla aprobada (categoría `UTILITY`). La revisión tarda hasta 24 h, así que hay que crearlas antes del lanzamiento. Dentro de la ventana se pueden enviar como texto libre.
- El sandbox no admite plantillas: esos flujos solo se prueban con un número de producción conectado.
- Dentro de la ventana de 24 h funcionan texto, botones, listas, ubicación y solicitud de ubicación.

## 0. Hechos base (confirmados previamente; no re-investigados)
- Proxy Meta: `https://api.kapso.ai/meta/whatsapp/v24.0` (mensajes: `/{phone_number_id}/messages`).
- Platform API: `https://api.kapso.ai/platform/v1`.
- Autenticación: `X-API-Key: <KAPSO_API_KEY>`. El proxy Meta admite también `Authorization: Bearer <token>` (alternativa heredada).
- Firma de webhook: `X-Webhook-Signature` = HMAC-SHA256 en hexadecimal del cuerpo crudo con el webhook secret. La página de seguridad lo confirma.
- Idempotencia: `X-Idempotency-Key`. Nombre del evento: `X-Webhook-Event` (ver 3.5).
- Payload `whatsapp.message.received`: `{ message: { id, timestamp, type, from, text: { body }, kapso: {...} }, conversation: {...}, is_new_conversation, phone_number_id }`.

Fuente: https://docs.kapso.ai/docs/platform/webhooks/security.md ; https://docs.kapso.ai/docs/platform/webhooks/overview.md

## 1. Envío de mensajes (proxy Meta)
`POST https://api.kapso.ai/meta/whatsapp/v24.0/{phone_number_id}/messages` con `X-API-Key` y `Content-Type: application/json`.
- Comunes: `messaging_product: "whatsapp"`, `to` (número con código de país; los ejemplos lo muestran sin "+"), `type`.
- Por BSUID, en lugar de `to`: `recipient_type: "individual"` y `recipient: "<BSUID>"`.
- Opcionales: `context.message_id` (responder) y `biz_opaque_callback_data` (hasta 512 caracteres; vuelve en los webhooks).

Fuente: https://docs.kapso.ai/api/meta/whatsapp/messages/send-a-message.md ; https://docs.kapso.ai/docs/whatsapp/send-messages/text.md

### 1.1 Ventana de 24 horas y plantillas
- "Non-template messages still require an open 24-hour customer service window." Aplica a texto, interactivos y ubicación.
- "Use an approved template to start or reopen a conversation." Para iniciar o reabrir una conversación: plantilla aprobada.
- Envío no-plantilla fuera de la ventana: HTTP 422.
- Apertura y cierre exactos de la ventana en Kapso: SIN CONFIRMAR (la regla estándar de Meta es 24 h desde el último mensaje del cliente).
- Número compartido: los no-plantilla solo salen si Kapso lleva el hilo o con `X-Kapso-Take-Control: true`. Las plantillas están exentas.

Fuente: https://docs.kapso.ai/docs/whatsapp/send-messages/text.md ; send-a-message.md

### 1.2 Texto con preview_url (literal de text.md; `preview_url` según el esquema)
```json
{ "messaging_product": "whatsapp", "to": "<TELEFONO>", "type": "text", "text": { "body": "<TEXTO>", "preview_url": true } }
```
- `preview_url`: booleano opcional, por defecto `false`. La guía no lo muestra: ejemplo completo SIN CONFIRMAR.

Fuente: https://docs.kapso.ai/docs/whatsapp/send-messages/text.md ; https://docs.kapso.ai/api/meta/whatsapp/messages/send-a-message.md

### 1.3 Botones de respuesta, máximo 3 (estructura de buttons.md; límites del esquema)
```json
{
  "messaging_product": "whatsapp", "to": "<TELEFONO>", "type": "interactive",
  "interactive": { "type": "button", "body": { "text": "<TEXTO>" }, "action": { "buttons": [
    { "type": "reply", "reply": { "id": "<ID_1>", "title": "<TITULO_1>" } },
    { "type": "reply", "reply": { "id": "<ID_2>", "title": "<TITULO_2>" } }
  ] } }
}
```
- Límites (esquema): de 1 a 3 botones; `reply.id` hasta 256 caracteres; `reply.title` hasta 20. La guía no indica límites.
- Respuesta del cliente: `type: "button_reply"` con su sub-objeto (nombre exacto SIN CONFIRMAR).

Fuente: https://docs.kapso.ai/docs/whatsapp/send-messages/buttons.md ; send-a-message.md

### 1.4 Lista interactiva (estructura de lists.md; límites del esquema)
```json
{
  "messaging_product": "whatsapp", "to": "<TELEFONO>", "type": "interactive",
  "interactive": { "type": "list", "body": { "text": "<TEXTO>" }, "action": {
    "button": "<ETIQUETA>", "sections": [ { "title": "<SECCION>", "rows": [
      { "id": "<ID_1>", "title": "<TITULO_1>", "description": "<DESCRIPCION_1>" },
      { "id": "<ID_2>", "title": "<TITULO_2>", "description": "<DESCRIPCION_2>" }
    ] } ] } }
}
```
- Límites (esquema): máximo 10 secciones y 10 filas en total; `action.button` hasta 20; `title` de fila hasta 24; `description` hasta 72. La guía no indica límites.
- Respuesta del cliente: `list_reply` (id, title, description); nombre exacto SIN CONFIRMAR.

Fuente: https://docs.kapso.ai/docs/whatsapp/send-messages/lists.md ; send-a-message.md

### 1.5 Ubicación (literal de location.md; solo se cambió `to`)
```json
{
  "messaging_product": "whatsapp", "to": "<TELEFONO>", "type": "location",
  "location": { "latitude": 37.7749, "longitude": -122.4194, "name": "<NOMBRE>", "address": "<DIRECCION>" }
}
```
- Coordenadas como números, no como texto (así en el ejemplo). `name` y `address` son opcionales. Rangos de coordenadas y longitudes máximas: SIN CONFIRMAR.
- Ubicación entrante: `type: "location"` con `location: { latitude, longitude, name?, address? }`.

Fuente: https://docs.kapso.ai/docs/whatsapp/send-messages/location.md ; location-request.md

### 1.6 Solicitar ubicación (literal de location-request.md; solo se cambió `to`)
```json
{
  "messaging_product": "whatsapp", "to": "<TELEFONO>", "type": "interactive",
  "interactive": { "type": "location_request_message", "body": { "text": "<TEXTO_SOLICITUD>" }, "action": { "name": "send_location" } }
}
```
- Muestra al cliente un botón "Send Location". Es un no-plantilla, así que requiere ventana abierta (inferencia; SIN CONFIRMAR para este tipo en particular).

Fuente: https://docs.kapso.ai/docs/whatsapp/send-messages/location-request.md

### 1.7 Plantilla con variables en el cuerpo (estructura de advanced.md y del SDK; valores propios)
```json
{
  "messaging_product": "whatsapp", "to": "<TELEFONO>", "type": "template",
  "template": { "name": "<NOMBRE_PLANTILLA_APROBADA>", "language": { "code": "es_MX" }, "components": [
    { "type": "body", "parameters": [ { "type": "text", "text": "<VALOR_1>" }, { "type": "text", "text": "<VALOR_2>" } ] }
  ] }
}
```
- `language.code` debe ser el idioma con el que se aprobó la plantilla. Kapso solo muestra `en` y `en_US` en sus ejemplos; `es` y `es_MX` son SIN CONFIRMAR en su documentación.
- Parámetros posicionales en el orden de {{1}}, {{2}}. En plantillas `NAMED`, cada parámetro lleva además `"parameter_name": "<nombre>"`.

Fuente: https://docs.kapso.ai/docs/whatsapp/templates/advanced.md ; https://docs.kapso.ai/docs/whatsapp/typescript-sdk/templates.md

### 1.8 Respuesta y errores
- 200 (forma según el resumen de la página): `{ messaging_product, contacts: [{ input, wa_id | user_id }], messages: [{ id: "wamid...." }] }`.
- Códigos documentados: 400, 401, 402, 404, 409, 422. Significado de 402 y 409: SIN CONFIRMAR.

Fuente: https://docs.kapso.ai/api/meta/whatsapp/messages/send-a-message.md

## 2. Sandbox
- Número compartido de Kapso para pruebas, no de producción. La página no muestra un campo `kind: "sandbox"` (SIN CONFIRMAR). En la API, el número sandbox tiene `meta_app_id: null`.
- Activación (solo desde el dashboard; no hay endpoints documentados):
  1. WhatsApp > Sandbox > "Add Test Number" > tu número de WhatsApp > "Create".
  2. Kapso muestra un código de 6 caracteres (distingue mayúsculas), el número sandbox y el botón "Open WhatsApp".
  3. Envía el código como mensaje desde ese mismo número. Según la página, desde otro dispositivo la activación no funciona.
  4. Kapso confirma al tester (texto no documentado). La sesión pasa de `pending_activation` a `active`.
- El código caduca 15 minutos después de crear la sesión: crea otra sesión. Si el número estaba activo en otro proyecto, esa sesión pasa a `superseded`.
- Límites: interactivos Sí; plantillas No; "Sync from WhatsApp" No; múltiples destinatarios No. `to` debe coincidir con el número registrado. Error típico: "Active sandbox session required to send messages".
- Máximo de testers, cuota de mensajes y duración: SIN CONFIRMAR.
- Webhooks: WhatsApp > Configurations > Sandbox WhatsApp > Manage Webhooks.
- Costo: los mensajes de sandbox usan créditos del proyecto, sin la cuota gratuita del número compartido. Precio por mensaje: SIN CONFIRMAR.

Fuente: https://docs.kapso.ai/docs/how-to/whatsapp/use-sandbox-for-testing.md ; https://docs.kapso.ai/docs/whatsapp/pricing-faq.md

## 3. Webhooks

### 3.1 Crear webhook de número (Platform API)
`POST https://api.kapso.ai/platform/v1/whatsapp/phone_numbers/{phone_number_id}/webhooks` con `X-API-Key` y `Content-Type: application/json`.
```json
{
  "whatsapp_webhook": {
    "kind": "kapso",
    "url": "https://<TU_DOMINIO>/webhooks/whatsapp",
    "secret_key": "<WEBHOOK_SECRET>",
    "active": true,
    "events": ["whatsapp.message.received", "whatsapp.message.sent", "whatsapp.message.delivered", "whatsapp.message.read", "whatsapp.message.failed"],
    "buffer_enabled": false,
    "buffer_window_seconds": 5,
    "max_buffer_size": 25,
    "buffer_events": ["whatsapp.message.received"],
    "inactivity_minutes": 60,
    "payload_version": "v2"
  }
}
```
- Obligatorios: `url` y `secret_key` (lo defines tú; la API no lo genera). Con `kind: "kapso"` (por defecto) `events` es obligatorio, con al menos uno.
- `kind: "meta"` reenvía el payload crudo de Meta, sin buffer. Solo puede haber un webhook Meta por número, aunque esté inactivo.
- `phone_number_id`: ID de Meta, es decir, el campo `phone_number_id` de `GET /platform/v1/whatsapp/phone_numbers` (4.3). Qué campo usa la ruta exactamente: SIN CONFIRMAR.
- Respuesta 201: `{ "data": { id, url, kind, events, active, buffer_*, payload_version, project_id, phone_number_id, created_at, updated_at } }`. Errores: 401, 404 y 422 con `{ "error": "..." }`.

Fuente: https://docs.kapso.ai/api/platform/v1/webhooks/create-webhook.md ; https://docs.kapso.ai/docs/platform/webhooks/overview.md

### 3.2 Webhook de proyecto
`POST https://api.kapso.ai/platform/v1/whatsapp/webhooks`, con el mismo wrapper `whatsapp_webhook`. Sin `phone_number_id` solo recibe eventos de proyecto, no de mensajes. Vistos en ejemplos: `whatsapp.phone_number.created`, `whatsapp.phone_number.deleted`, `project.event` (requiere plan; 402). Lista completa: SIN CONFIRMAR.

Fuente: https://docs.kapso.ai/api/platform/v1/webhooks/create-project-webhook.md

### 3.3 Crear desde el dashboard
- Eventos de proyecto: Integrations > Webhooks > pestaña "Platform webhooks" > "Add Webhook" (URL HTTPS, copiar el secreto generado, elegir eventos).
- Meta por número: editar el número > "Webhook destination URL".
- Mensajes de un número de producción: SIN CONFIRMAR (solo documentado para sandbox).

Fuente: https://docs.kapso.ai/docs/platform/webhooks/overview.md

### 3.4 Eventos (12 documentados)
- Mensajes: `whatsapp.message.received`, `.sent`, `.delivered`, `.read`, `.failed`. El prefijo `whatsapp.message.*` es un comodín, no un evento. `.read` no tiene payload de ejemplo; `.failed` trae `errors` (code, title, message).
- Conversaciones: `whatsapp.conversation.created`, `.ended` (cierre por agente, manual o tras 24 h inactiva), `.inactive` (de 1 a 1440 min; por defecto 60).
- Contactos: `whatsapp.contact.identity_changed`, `whatsapp.contact.marketing_preference_changed`.
- Número compartido: `whatsapp.thread.ownership_changed`, `whatsapp.thread.standby`.

Fuente: https://docs.kapso.ai/docs/platform/webhooks/message-events.md

### 3.5 Entrega y firma
- Cabeceras: `X-Webhook-Event`, `X-Webhook-Signature`, `X-Idempotency-Key`, `X-Webhook-Payload-Version: v2`, `Content-Type: application/json`. En lotes: `X-Webhook-Batch: true` y `X-Batch-Size`.
- Discrepancia: la visión general sitúa el evento en `X-Webhook-Event`; los ejemplos de seguridad leen un campo `event` del cuerpo. SIN CONFIRMAR: probar con una entrega real.
- Verificación: HMAC-SHA256 del cuerpo crudo (bytes exactos, antes de parsear) con el secret, en hex; comparar en tiempo constante; si no coincide, responder 401. No hay timestamp ni protección contra repetición documentados: deduplicar por `X-Idempotency-Key` (guardar las claves procesadas y responder 200 sin reprocesar).
- Responder 200 dentro de 10 s. Si una respuesta más lenta cuenta como fallo: SIN CONFIRMAR.

Fuente: https://docs.kapso.ai/docs/platform/webhooks/security.md ; https://docs.kapso.ai/docs/platform/webhooks/advanced.md

### 3.6 Reintentos y pausa automática
- Se reintenta cuando no llega un 200. `max_attempts` = 3 por defecto (incluye el primer envío): inmediato, +10 s y +40 s. Dónde se configura: SIN CONFIRMAR.
- Tras el último intento la entrega queda fallida; los lotes fallidos se reenvían como entregas individuales. Reenvío manual y cola de fallos: SIN CONFIRMAR (existe el listado `GET /platform/v1/webhook-deliveries`).
- Pausa automática: si en 15 min se cumplen a la vez ≥40 entregas, ≥10 fallidas y ≥85 % de fallos, el webhook pasa a `active: false`. Las pendientes fallan con "Webhook inactive; delivery skipped." y se avisa por correo a los miembros del proyecto. Reactivar: Integrations > Webhooks.

Fuente: https://docs.kapso.ai/docs/platform/webhooks/advanced.md

### 3.7 Lotes (buffer)
- Config: `buffer_enabled`; `buffer_window_seconds` de 1 a 60 (por defecto 5); `max_buffer_size` de 1 a 100 (por defecto 50, según la guía); `buffer_events`. Solo con `kind: "kapso"`.
- Un lote sale al llenarse o al cerrarse la ventana, y siempre es de una sola conversación. Con buffer activo, todas las entregas van en formato de lote, aunque tengan un solo mensaje.
```json
{
  "type": "whatsapp.message.received",
  "batch": true,
  "data": [ { "message": { "...": "igual que el payload individual" }, "conversation": { "...": "..." }, "is_new_conversation": false, "phone_number_id": "<PHONE_NUMBER_ID>" } ],
  "batch_info": { "size": 2, "window_ms": 5000, "first_sequence": 101, "last_sequence": 102, "conversation_id": "<CONVERSATION_UUID>" }
}
```
- Detectar un lote: cabecera `X-Webhook-Batch` = "true" o `batch === true`; luego procesar cada elemento de `data`.
- Orden: secuencia por conversación; un mensaje espera hasta 30 s si falta uno anterior. Si cada mensaje reinicia la ventana: SIN CONFIRMAR.

Fuente: https://docs.kapso.ai/docs/platform/webhooks/advanced.md ; overview.md

## 4. Historial de mensajes y conversaciones

### 4.1 Platform API (filtros por query, ámbito de proyecto)
- `GET https://api.kapso.ai/platform/v1/whatsapp/messages`. Query: `phone_number_id`, `conversation_id` (UUID), `phone_number` (coincidencia parcial), `business_scoped_user_id`, `direction` (`inbound`|`outbound`), `status` (`pending`|`sent`|`delivered`|`read`|`failed`), `message_type`, `has_media`, `limit` (1 a 100; por defecto 20), `after` y `before` (cursores Base64). Respuesta: `data[]` del más nuevo al más antiguo y `paging.cursors.{after,before}`. No existen `page`, `since`, `until` ni `sort`.
- `GET https://api.kapso.ai/platform/v1/whatsapp/conversations`. Query: `phone_number_id`, `phone_number`, `status` (`active`|`ended`), `assigned_user_id`, `unassigned` (no combinar con `assigned_user_id`), `created_after`, `created_before`, `last_active_after`, `last_active_before`, `limit` (1 a 100; por defecto 20), `before` y `after`. Orden: última actividad primero.
- En `kapso` de los mensajes: `direction`, `status`, `processing_status`, `origin` (`cloud_api`|`business_app`|`history_sync`), `whatsapp_conversation_id`, `content`, `media_url`, `transcript`, `statuses`. Los valores de `processing_status` difieren entre endpoints: SIN CONFIRMAR.

Fuente: https://docs.kapso.ai/api/platform/v1/messages/list-messages.md ; https://docs.kapso.ai/api/platform/v1/conversations/list-conversations.md

### 4.2 Proxy Meta (ámbito de un número)
- `GET https://api.kapso.ai/meta/whatsapp/v24.0/{phone_number_id}/messages`. Query: `conversation_id`, `direction`, `status`, `since` y `until` (ISO 8601, inclusivos), `limit` (1 a 100; por defecto 20), `before`, `after`, `fields` (p. ej. `kapso(direction,status)`).
- `GET https://api.kapso.ai/meta/whatsapp/v24.0/{phone_number_id}/conversations`. Query: `status`, `assigned_user_id`, `unassigned`, `last_active_since`, `last_active_until`, `phone_number`, `limit`, `before`, `after`, `fields=kapso()`.
- Discrepancia: el ejemplo de mensajes muestra `type: "button"`, que el esquema no lista. Confirmar con una respuesta real.

Fuente: https://docs.kapso.ai/api/meta/whatsapp/messages/list-messages.md ; https://docs.kapso.ai/api/meta/whatsapp/conversations/list-conversations.md

### 4.3 Números de teléfono (de dónde salen los IDs)
- `GET https://api.kapso.ai/platform/v1/whatsapp/phone_numbers`. Query: `phone_number_id`, `business_account_id`, `messaging_enabled`, `name_contains`, `per_page` (20 por defecto), `page` (1 por defecto). Respuesta: `{ data: [...], meta: { page, per_page, total_pages, total_count } }`.
- `phone_number_id` = ID de Meta (`id` tiene el mismo valor). `business_account_id` = WABA, necesario para plantillas. `internal_id` es de Kapso, no el ID de Meta. Campos útiles: `status`, `quality_rating` (GREEN|YELLOW|RED), `throughput_tier`, `whatsapp_business_manager_messaging_limit`, `meta_app_id` (null en sandbox).

Fuente: https://docs.kapso.ai/api/platform/v1/phone-numbers/list-phone-numbers.md

## 5. Plantillas

### 5.1 Crear y actualizar (proxy Meta; usa el WABA, no el número)
`POST https://api.kapso.ai/meta/whatsapp/v24.0/{business_account_id}/message_templates` con `X-API-Key`. Para actualizar: el mismo endpoint con `?hsm_id=<TEMPLATE_ID>`.
```json
{
  "name": "confirmacion_reserva", "language": "es_MX", "category": "UTILITY", "parameter_format": "POSITIONAL",
  "components": [ { "type": "BODY", "text": "Hola {{1}}, tu reserva para {{2}} está confirmada.", "example": { "body_text": [["Ana", "el 5 de noviembre"]] } } ]
}
```
- `category`: `AUTHENTICATION` | `MARKETING` | `UTILITY`. `parameter_format`: `NAMED` | `POSITIONAL` (por defecto POSITIONAL). `components`: `HEADER` (TEXT|IMAGE|VIDEO|DOCUMENT|LOCATION), `BODY` (obligatorio), `FOOTER`, `BUTTONS` (QUICK_REPLY hasta 10; URL hasta 2; PHONE_NUMBER y COPY_CODE hasta 1).
- `example.body_text` (arrays anidados) viene del resumen de la página: SIN CONFIRMAR como literal. `es_MX`: SIN CONFIRMAR.
- Respuesta 200: `{ id, status: "PENDING", category }`. Actualizar devuelve `success: true`. Errores 400, 401 y 404 con `{ error: { message, type, code } }`.
- La API permite actualizar con `hsm_id`, pero la guía de ciclo de vida dice que una plantilla enviada no se edita y que los cambios crean una nueva versión: SIN CONFIRMAR cuál aplica a plantillas aprobadas.
- Categoría: las confirmaciones y recordatorios de reserva corresponden a `UTILITY` según la política de Meta; Kapso no define criterios propios. Meta puede rechazar por "Incorrect category selection (utility vs marketing)".

Fuente: https://docs.kapso.ai/api/meta/whatsapp/templates/create-or-update-message-template.md ; https://docs.kapso.ai/docs/whatsapp/templates/lifecycle.md

### 5.2 Listar
`GET https://api.kapso.ai/meta/whatsapp/v24.0/{business_account_id}/message_templates`. Query: `name`, `status` (`APPROVED`|`PENDING`|`REJECTED`), `category`, `language` (p. ej. `en_US`), `limit` (1 a 100; por defecto 20). Respuesta: `data[]` con `id`, `name`, `language`, `status`, `category`, `previous_category`, `components`; y `paging.cursors`.

Fuente: https://docs.kapso.ai/api/meta/whatsapp/templates/list-message-templates.md

### 5.3 Estados, revisión y calidad
- `PENDING` (en revisión; no se puede usar), `APPROVED` (usable), `REJECTED` (leer el motivo y enviar una nueva versión), `DISABLED` (desactivada temporalmente por Meta).
- Revisión: "up to 24 hours"; las cuentas nuevas pueden tardar más.
- Calidad: `quality_score` GREEN | YELLOW | RED | UNKNOWN. Umbrales de pausa: SIN CONFIRMAR.

Fuente: https://docs.kapso.ai/docs/whatsapp/templates/lifecycle.md

### 5.4 Estado en este proyecto
- `src\lib\whatsapp\templates.ts:12` y `src\lib\whatsapp\admin-bot.ts:19` mencionan "the Kapso sender" y "the Kapso webhook". No hay uso de `language`, `es_MX` ni categorías en `src\lib\whatsapp`. Estado real de la integración: SIN CONFIRMAR.

## 6. Servidor MCP de Kapso
- URL `https://api.kapso.ai/mcp` (transporte HTTP). No es el MCP de documentación (`https://docs.kapso.ai/mcp`).
- Acceso: inicio de sesión en el navegador (solo la URL) o API key con `Authorization: Bearer` o `X-API-Key`. Permisos: "Read only" (por defecto), "Full access" o "Custom", con ámbitos como `mcp:messages:send` y `mcp:templates:read|write`.
- Herramientas: `status`, `search_docs`, `customers`, `setup_links`, `whatsapp_numbers`, `whatsapp_contacts`, `whatsapp_conversations`, `whatsapp_conversation_assignments`, `whatsapp_messages` (listar, leer, enviar, marcar leído), `whatsapp_templates` (listar, leer, crear; sin actualizar ni borrar), `whatsapp_flows`, `whatsapp_webhooks`, `project_events`, `project_event_definitions`, `whatsapp_broadcasts`, `workflows`, `workflow_executions`, `functions`, `findings`, verificación de negocio y `list_provider_models`.
- Cupo: consume el límite por minuto de la Platform API (salvo `findings`). Sin el ámbito necesario, error `insufficient_scope`. Publicar un Flow no se puede revertir en Meta.
- Claude Code: `claude mcp add --transport http kapso https://api.kapso.ai/mcp --header "X-API-Key: $KAPSO_API_KEY"`.

Fuente: https://docs.kapso.ai/docs/whatsapp/mcp.md

## 7. Límites de tasa y de mensajería
- API, por API key, en ventanas fijas de 1 minuto: Free 100; Pro 1.000; Platform 2.000; Enterprise 4.000 peticiones/min (sin plan activo: 100). Ejecuciones de workflow por segundo y por workflow: 5 (Free), 15 (Pro), 30 (Platform y Enterprise).
- Exceso: HTTP 429 (`error: "Rate limit exceeded"`). Cabeceras: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After` (segundos); en ráfagas, `X-Burst-RateLimit-*`. Reintento: espera exponencial con `Retry-After` como base.
- Meta: el límite del lado de Meta responde "Meta API rate limit exceeded. Retry after 60 seconds". Límite por nivel de mensajería: SIN CONFIRMAR (ver `throughput_tier` y `whatsapp_business_manager_messaging_limit` en phone_numbers).
- Plan Kapso, mensajes al mes (entrantes y salientes; las reacciones cuentan, los acuses de lectura no): Free 2.000 y 1 número; Pro 100.000 y 3 números (+10 USD por número extra); Platform 1.000.000 y 50 números (+5 USD); Enterprise a medida.
- Meta: cada número tiene 1.000 mensajes de servicio entregados gratis al mes. Según la página, desde el 1 de octubre de 2026 los no-plantilla en números de producción conectados son facturables al superar esa cuota (ya vigente).
- Plantillas: facturadas. Una UTILITY dentro de la ventana figura como "Charged at the utility rate". Tarifas por país y categoría, y conversaciones únicas por 24 h: SIN CONFIRMAR.

Fuente: https://docs.kapso.ai/api/rate-limits.md ; https://docs.kapso.ai/docs/whatsapp/pricing-faq.md

## 8. Pendiente de confirmar (SIN CONFIRMAR)
- Ventana de 24 h: apertura y cierre exactos, y si aplica en sandbox.
- Idiomas `es` y `es_MX` en plantillas de Kapso.
- `kind: "sandbox"` en la API y endpoints de sandbox.
- Nombre del evento: cabecera `X-Webhook-Event` frente a campo `event`.
- `max_attempts` configurable; formato y retención de la idempotencia; cola de fallos y reenvío manual.
- Campo exacto de `{phone_number_id}` en la creación de webhooks.
- Límites de longitud de botones y listas (solo del esquema); tiers y throughput de mensajería.
