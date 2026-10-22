# Wompi El Salvador: referencia de integración

Investigado el 2026-10-22. Fuente principal: documentación oficial de Wompi, https://docs.wompi.sv/ (índice: https://docs.wompi.sv/sitemap.md; volcado: https://docs.wompi.sv/llms-full.txt). Los textos y JSON se leyeron con WebFetch, que resume las páginas: contrastar con la página antes de implementar.

- **SIN CONFIRMAR**: no aparece en la documentación oficial revisada.
- **NO OFICIAL**: dato de un paquete de terceros, usado solo para confirmar nombres de campos: https://github.com/rmirandasv/laravel-wompi. No se usó ningún otro paquete.

## 0. Resumen

- Token: `POST https://id.wompi.sv/connect/token` (`grant_type=client_credentials`, `audience=wompi_api`).
- Enlace de pago: `POST https://api.wompi.sv/EnlacePago`.
- Redirect: `hash` = HMAC-SHA256 con el API Secret sobre los parámetros concatenados (separador **SIN CONFIRMAR**).
- Webhook: `POST` a nuestra URL con el header `wompi_hash` = HMAC-SHA256 con el API Secret sobre el body crudo.
- Confirmación: `GET https://api.wompi.sv/TransaccionCompra/{idTransaccion}`.
- Pruebas: modo desarrollo por negocio en el Panel; no hay host sandbox documentado.

Fuentes: ver secciones 1 a 8.

## 1. Autenticación

Fuente: https://docs.wompi.sv/autenticacion/autenticacion.md

- `POST https://id.wompi.sv/connect/token` con `Content-Type: application/x-www-form-urlencoded`.
- Cuerpo: `grant_type=client_credentials` (fijo), `audience=wompi_api` (fijo), `client_id` (App ID), `client_secret` (API Secret). No se envía `scope`.
- Respuesta:

```json
{ "access_token": "...", "expires_in": 3600, "token_type": "Bearer", "scope": "wompi_api" }
```

- `expires_in` en segundos (3600 en el ejemplo). La doc dice que no hace falta pedir un token por petición. Renovación y caducidad anticipada: **SIN CONFIRMAR**. Recomendación: cachear el token hasta cerca de su vencimiento.
- Uso: header `authorization: Bearer <access_token>` en todas las peticiones. Los ejemplos añaden `content-type: application/json`.
- App ID = `client_id`; API Secret = `client_secret`. Están en el detalle del negocio, en el Panel https://panel.wompi.sv. Etiquetas exactas en pantalla: **SIN CONFIRMAR**.
- Los ejemplos cURL, C#, PHP y Java usan placeholders (`YOUR_DOMAIN`, `YOUR_API_IDENTIFIER`, `${account.clientId}`). No copiarlos.

## 2. URLs base

Fuentes: https://docs.wompi.sv/metodos-api/enlace-de-pago.md, https://docs.wompi.sv/metodos-api/datos-aplicativo.md

- API: `https://api.wompi.sv`. Es el único host de API que aparece en la doc; no se etiqueta como producción. Las rutas son relativas a este host.
- Auth: `https://id.wompi.sv/connect/token`. Panel: `https://panel.wompi.sv`.
- Host sandbox: **SIN CONFIRMAR** (ver sección 7).

## 3. Crear enlace de pago

Fuente: https://docs.wompi.sv/metodos-api/enlace-de-pago.md

- `POST https://api.wompi.sv/EnlacePago` con los headers de la sección 1. La página no muestra headers propios.
- Montos en dólares (la doc de transacciones dice "en dólares"). Moneda del enlace: **SIN CONFIRMAR**.

Cuerpo de ejemplo (estructura de la doc con valores nuestros; se quitó la coma final que trae la doc):

```json
{
  "identificadorEnlaceComercio": "RES-1234",
  "monto": 25.5,
  "nombreProducto": "Tour Ruta de las Flores",
  "formaPago": { "permitirTarjetaCreditoDebido": true, "permitirPagoConPuntoAgricola": false, "permitirPagoEnCuotasAgricola": false, "permitirPagoEnBitcoin": false, "permitePagoQuickPay": false },
  "configuracion": {
    "urlRedirect": "https://<dominio>/reserva/pago/retorno",
    "urlWebhook": "https://<dominio>/api/pagos/wompi/webhook",
    "emailsNotificacion": "reservas@<dominio>",
    "notificarTransaccionCliente": true,
    "urlRetorno": "https://<dominio>/reserva"
  }
}
```

Campos:
- `identificadorEnlaceComercio` (obligatorio, string, máx. 500): nuestro ID. Vuelve en el redirect y en el webhook.
- `monto` (obligatorio, número): mínimo 0.01.
- `nombreProducto` (obligatorio, string, máx. 500).
- `formaPago` (opcional): si se envía, sus cinco flags son obligatorios y al menos uno debe ser `true`. Si se omite, la doc dice que solo se aceptan tarjeta y puntos. Flags: `permitirTarjetaCreditoDebido`, `permitirPagoConPuntoAgricola`, `permitirPagoEnCuotasAgricola`, `permitirPagoEnBitcoin`, `permitePagoQuickPay`. La última está escrita así en la doc: posible errata, **SIN CONFIRMAR**.
- `cantidadMaximaCuotas` (opcional, enum): `"Tres"`, `"Seis"`, `"Nueve"`, `"Doce"`.
- `idGrupoTarjetas` (opcional, string): grupo de tarjetas del Panel.
- `infoProducto` (opcional): `descripcionProducto`, `urlImagenProducto`.
- `configuracion` (opcional):
  - `urlRedirect` (url): a dónde vuelve el cliente tras pagar.
  - `urlWebhook` (url): recibe los datos de transacciones exitosas. Regla: `urlWebhook` o `emailsNotificacion`, al menos uno.
  - `emailsNotificacion`, `telefonosNotificacion` (strings separados por coma). `notificarTransaccionCliente` (bool) es obligatorio si va `configuracion`.
  - `urlRetorno` (url): destino del botón "atrás" en la pantalla de pago. `esMontoEditable`, `esCantidadEditable` (bool).
  - `cantidadPorDefecto`: la tabla dice bool y la descripción dice cantidad (**SIN CONFIRMAR**). `duracionInterfazIntentoMinutos` (entero): minutos de validez de la pantalla de pago una vez mostrada.
- `vigencia` (opcional): `fechaInicio`, `fechaFin` (fecha ISO 8601).
- `limitesDeUso` (opcional): `cantidadMaximaPagosExitosos`, `cantidadMaximaPagosFallidos` (enteros).

Respuesta:

```json
{ "idEnlace": 15, "urlQrCodeEnlace": "https://wompistorage.blob.core.windows.net/imagenes/<uuid>.jpg", "urlEnlace": "https://lk.wompi.sv/yhDt", "estaProductivo": false }
```

- `idEnlace` (entero): guardarlo. `urlEnlace`: enlace corto para el cliente. `urlQrCodeEnlace`: imagen QR del mismo enlace.
- `estaProductivo`: `false` = modo desarrollo. La tabla lo marca como "Url", pero el ejemplo es booleano. En producción debe ser `true`.
- Códigos de error y formato de errores: **SIN CONFIRMAR**.

Medios de pago habilitados: `GET https://api.wompi.sv/Aplicativo`. Fuente: https://docs.wompi.sv/metodos-api/datos-aplicativo.md. Devuelve `idAplicativo`, `clientIdApi`, `numeroCuenta`, `nombre`, `urlAplicativo`, `estaProductivo`, `urlLogo`, `aplicaPagoConPuntos`, `aplicaPagoConBitcoin`, `aplicaPagoConQuickPay` y `cuotasDisponibles` (lista de `{cantidadCuotas, tasa}`). No hay flag de cuotas. Headers: **SIN CONFIRMAR**.

## 4. Redirect (`urlRedirect`)

Fuentes: https://docs.wompi.sv/redirect-url/parametros-de-url-de-redirect.md, https://docs.wompi.sv/redirect-url/validar-parametros-url-redirect.md

Parámetros que Wompi añade a la URL de redirect (query string):

| Parámetro | Flujo | Formato o valores |
|---|---|---|
| `idTransaccion` | ambos | Cadena de 36 caracteres |
| `monto` | ambos | Decimal `#####.##` |
| `hash` | ambos | HMAC, ver validación |
| `identificadorEnlaceComercio` | enlace | El valor que enviamos al crear el enlace |
| `idEnlace` | enlace | Entero |
| `esReal` | API | `true` real, `false` prueba (el ejemplo muestra `True`) |
| `formaPago` | API | `PagoNormal`, `Puntos`, `Cuotas`, `Bitcoin` |
| `esAprobada` | API | `true` exitosa, `false` fallida |
| `codigoAutorizacion` | API | Texto; la doc dice que no debería superar 10 caracteres |
| `mensaje` | API | Máx. 50 caracteres; explica la falla |

- Según la tabla, `esReal`, `formaPago`, `esAprobada`, `codigoAutorizacion` y `mensaje` son del flujo API. Un paquete NO OFICIAL usa `esAprobada` y `mensaje` en el retorno de sus enlaces. Por eso el conjunto exacto para enlaces es **SIN CONFIRMAR**.
- Ejemplo (flujo API, de la doc):

```
https://wompi.sv/?idTransaccion=0abac760-e642-46e0-b658-0f526957b88a&monto=10&esReal=True&formaPago=PagoNormal&esAprobada=True&codigoAutorizacion=270015&mensaje=AUTORIZADO&hash=986d4c7667bd0a9ef446dbbbb5939618c7a51f6a4860d34259a1c76f2a8f0d03
```

Validación de `hash`:
1. Concatenar en este orden. Enlace: `identificadorEnlaceComercio` + `idTransaccion` + `idEnlace` + `monto`. API: `idTransaccion` + `monto` + `esReal` + `formaPago` + `esAprobada` + `codigoAutorizacion` + `mensaje`.
2. Calcular HMAC-SHA256 de esa cadena, con clave = API Secret (el mismo valor que `client_secret`).
3. Comparar con `hash`. Si coincide, los parámetros no se modificaron en tránsito.

- Separador entre valores: **SIN CONFIRMAR** (la doc no lo dice).
- Codificación de la salida: **SIN CONFIRMAR** en la prosa. El ejemplo C# convierte cada byte con `ToString("x2")`, es decir, hex minúsculas.
- Booleanos: el ejemplo usa `True` y la descripción `true`. Usar el texto literal recibido en la query. Qué forma usa el hash: **SIN CONFIRMAR**.
- El hash del ejemplo no se puede comprobar: la doc no publica el secreto.
- La doc advierte que, si solo se usa el redirect, hay que validar el hash. El redirect no basta para confirmar el pago (sección 6).

## 5. Webhook

Fuentes: https://docs.wompi.sv/webhook/definicion-webhook.md, https://docs.wompi.sv/webhook/validar-webhook.md, https://docs.wompi.sv/webhook/como-registrar-mi-webhook.md

- Método: `POST` a la URL configurada. En el Panel: detalle del aplicativo, campo "Notifica via Webhook". Por enlace: `configuracion.urlWebhook`.
- La doc lo describe como notificación de transacciones exitosas. Envío en fallidas, reintentos, código HTTP esperado, timeout y requisitos HTTPS: **SIN CONFIRMAR**.
- Header de firma: `wompi_hash`. Tiene guion bajo; algunos proxies (nginx por defecto) lo descartan. Verificarlo en pruebas (recomendación nuestra).

Payload de ejemplo (nombres de la doc; valores abreviados):

```json
{
  "IdCuenta": "string", "FechaTransaccion": "2020-07-07T21:27:03.3403497-06:00", "Monto": 1,
  "ModuloUtilizado": "BotonPago", "FormaPagoUtilizada": "PagoNormal",
  "IdTransaccion": "2bedafea-0924-49f0-927d-8c638e193990", "ResultadoTransaccion": "ExitosaAprobada",
  "CodigoAutorizacion": "string", "IdIntentoPago": "string", "Cantidad": 1, "EsProductiva": false,
  "Aplicativo": { "Nombre": "string", "Url": "string", "Id": "string" },
  "EnlacePago": { "Id": 66, "IdentificadorEnlaceComercio": "OC1234", "NombreProducto": "string" },
  "cliente": { "Nombre": "string", "Email": "string", "additionalProp1": "string", "additionalProp2": "string" }
}
```

- Tipos y descripciones de cada campo: **SIN CONFIRMAR** (la doc no los define). Los `additionalProp1/2` del objeto `cliente` parecen artefactos del ejemplo: **SIN CONFIRMAR**.
- `ResultadoTransaccion`: solo consta `"ExitosaAprobada"`. Lista completa: **SIN CONFIRMAR**.
- `EsProductiva: false` indica transacción de prueba (sección 7).
- NO OFICIAL: el paquete rmirandasv escribe `enlacePago` en minúsculas. La doc oficial usa `EnlacePago`. Usar la oficial y verificarlo en pruebas.

Verificación de firma (doc de validación):
1. Leer el body completo tal como llega, sin reformatear ni añadir espacios o saltos de línea. En Next.js, leerlo como texto antes de hacer `JSON.parse`.
2. Calcular HMAC-SHA256 del body (UTF-8) con clave = API Secret.
3. Comparar con `wompi_hash`. Si coincide, el webhook es válido.

- Codificación (hex minúsculas según el ejemplo C#) y regla de comparación: **SIN CONFIRMAR**. Comparación en tiempo constante: recomendación nuestra.
- Secreto de webhook separado: **no documentado**. La firma usa el API Secret. NO OFICIAL: el paquete rmirandasv usa una variable `WOMPI_WEBHOOK_SECRET`.

## 6. Confirmar la transacción en servidor

Fuente: https://docs.wompi.sv/metodos-api/obtener-transaccion-compra-por-id.md

- `GET https://api.wompi.sv/TransaccionCompra/{id}`, donde `{id}` = `idTransaccion`. La página no muestra la URL completa ni headers; el header de autenticación va en todas las peticiones (sección 1). Host: **SIN CONFIRMAR** en esta página.
- Respuesta (ejemplo de la doc):

```json
{
  "datosBitcoin": {...}, "datosAdicionales": {...}, "resultadoTransaccion": 0,
  "fechaTransaccion": "2026-03-10T16:31:35.875Z", "montoOriginal": 0, "idTransaccion": "string",
  "esReal": true, "esAprobada": true, "codigoAutorizacion": "string", "mensaje": "string",
  "formaPago": 0, "monto": 0, "idExterno": "string"
}
```

- `resultadoTransaccion` es "Resultado final de la transacción" (entero). Sus valores: **SIN CONFIRMAR**.
- Discrepancias a confirmar con una transacción real de prueba: `resultadoTransaccion` es entero aquí, pero `ResultadoTransaccion` es texto en el webhook. `formaPago` es entero aquí (crear transacción: 0 PagoNormal, 1 Puntos, 2 Cuotas, 3 Bitcoin, 4 QuickPay) y texto en redirect y webhook.
- Criterio sugerido (recomendación nuestra): dar por pagada solo si `esAprobada === true`, `monto` coincide con el esperado y, en producción, `esReal === true`.

## 7. Sandbox y modo de prueba

Fuentes: https://docs.wompi.sv/metodos-api/transaccion_prueba.md, https://docs.wompi.sv/metodos-api/crear-transaccion-compra-3ds.md

- Host sandbox y credenciales separadas: **SIN CONFIRMAR**. Una búsqueda sobre wompi.sv y docs.wompi.sv tampoco encontró ninguno.
- El modo prueba se activa poniendo el negocio en "modo desarrollo" en el Panel. Pasar a producción también se hace allí.
- Indicadores (`false` = prueba): `estaProductivo` (enlace y `GET /Aplicativo`), `esReal` (transacción, redirect y 3DS), `EsProductiva` (webhook). Las transacciones de prueba no aparecen en el reporte de transacciones.
- Por defecto, las transacciones en modo desarrollo se autorizan como cobros exitosos. No se cobra al cliente (`esReal: false`).
- Rechazo simulado: CVV `111` en la pantalla de pago de Wompi (enlaces y botones). Los rechazos no se simulan con 3DS.
- Tarjetas de prueba: **SIN CONFIRMAR** (no están documentadas).
- Webhook en prueba: el ejemplo trae `EsProductiva: false`, lo que sugiere que también se envía en prueba: **SIN CONFIRMAR**.

## 8. Alternativa 3DS (breve)

Fuentes: https://docs.wompi.sv/metodos-api/crear-transaccion-compra-3ds.md, https://docs.wompi.sv/metodos-api/crear-transaccion-compra.md

- `POST https://api.wompi.sv/TransaccionCompra/3DS`. Cuerpo: `tarjetaCreditoDebido` {`numeroTarjeta`, `cvv`, `mesVencimiento`, `anioVencimiento`}, `monto`, `urlRedirect` (significado **SIN CONFIRMAR**), `nombre`, `apellido`, `email`, `ciudad`, `direccion`, `idPais` (ISO 3166-1 alfa-2), `idRegion` (ISO 3166-2), `codigoPostal`, `telefono`. La tabla escribe `tarjetaCreditoDebito`; el JSON, `tarjetaCreditoDebido`.
- Respuesta: `idTransaccion`, `esReal`, `urlCompletarPago3Ds`, `monto`. Hay que redirigir al pagador a `urlCompletarPago3Ds`.
- Con 3DS la app recibe datos crudos de tarjeta (alcance PCI). Recomendación nuestra: usar el enlace de pago salvo decisión explícita.
- `POST /TransaccionCompra` sin 3DS: la doc exige permiso especial de soporte.

## 9. Checklist para activar en nuestra app

Fuentes: secciones 3 a 5; https://panel.wompi.sv

- Variables de entorno (solo en servidor):
  - `WOMPI_CLIENT_ID` = App ID (`client_id`).
  - `WOMPI_CLIENT_SECRET` = API Secret (`client_secret`). También es la clave HMAC del redirect y del webhook.
  - `WOMPI_WEBHOOK_SECRET`: no hace falta según la doc. No crearla salvo que Wompi confirme un secreto separado (**SIN CONFIRMAR**).
  - Opcionales: `WOMPI_AUTH_URL=https://id.wompi.sv/connect/token`, `WOMPI_API_URL=https://api.wompi.sv`.
- URLs a registrar:
  - Redirect: `https://<dominio>/reserva/pago/retorno`, en `configuracion.urlRedirect` de cada enlace.
  - Webhook: `https://<dominio>/api/pagos/wompi/webhook`, en el Panel ("Notifica via Webhook") y/o en `configuracion.urlWebhook` de cada enlace.
- Estado del repo (solo lectura): `src/lib/domain/types.ts` define `PaymentMethod = "en_sitio" | "wompi"`. `src/lib/sim/state.ts` simula Wompi "until keys exist". No hay carpetas `api` bajo `src/`. Los montos del dominio están en USD (`payment.amountUsd`).
- Flujo propuesto (no documentado por Wompi):
  1. Al reservar, `POST /EnlacePago` con `identificadorEnlaceComercio` = id de la reserva. Guardar `idEnlace` y `urlEnlace`.
  2. Retorno: validar `hash` y guardar `idTransaccion`. No marcar como pagado solo por el redirect.
  3. Webhook: validar `wompi_hash` sobre el body crudo y procesar de forma idempotente por `IdTransaccion`. Reintentos: **SIN CONFIRMAR**.
  4. Confirmar con `GET /TransaccionCompra/{IdTransaccion}` según el criterio de la sección 6.
  5. Pruebas en modo desarrollo: aprobado por defecto; rechazo con CVV `111`; validar el hash con un redirect real antes de fijar la concatenación.

## 10. Pendientes y errores de la documentación

Fuentes: las páginas citadas en las secciones anteriores.

- Pendientes (**SIN CONFIRMAR**): separador y codificación del hash del redirect; ortografía de `permitePagoQuickPay`; host sandbox y tarjetas de prueba; reintentos y códigos HTTP del webhook; valores de `ResultadoTransaccion`; tipo de `resultadoTransaccion` y `formaPago`; casing de `EnlacePago` en el webhook; formato de errores; renovación del token; moneda del enlace.
- Errores de la doc: JSON de enlace y 3DS con coma final; `cantidadPorDefecto` (bool vs cantidad); `estaProductivo` ("Url" vs booleano); `tarjetaCreditoDebito` vs `tarjetaCreditoDebido`; `true` vs `True` en `esReal`; ejemplos con placeholders; notas de Bitcoin y QuickPay copiadas del texto de cuotas.
- Otros endpoints del sitemap, no revisados: `GET /EnlacePago`, `GET /EnlacePago/{id}`, activar, desactivar y actualizar enlace, `POST /Tokenizacion`, `POST /EnlacePagoRecurrente`, `GET /Cuenta`, `GET /api/Regiones`.

## 11. Estado en este proyecto (22 de octubre de 2026)

- Aplicativo "Wilber Tours" en **modo prueba** (`estaProductivo: false`). Las llaves están en `.env.local` (no se sube) y en Vercel, producción y preview: `WOMPI_CLIENT_ID` y `WOMPI_CLIENT_SECRET` (esta marcada como sensible).
- Probado: el token OAuth de `id.wompi.sv` responde 200 y `GET /Aplicativo` devuelve el aplicativo. `POST /api/pagos/wompi/enlace` crea enlaces de prueba en local y en `wilbertours.vercel.app` (`https://s.wompi.sv/…`).
- Con las llaves puestas, el paso de pago de la reserva usa el enlace real de Wompi en vez del pago simulado.
- Falta confirmar con un pago de prueba completo: el hash del redirect (`verifyRedirectHash`) y el cuerpo del webhook.
- Antes de pasar a producción: generar un API Secret nuevo en el Panel (el actual se compartió en el chat), actualizarlo en Vercel y desactivar el modo prueba.
