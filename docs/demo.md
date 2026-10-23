# Guion de demo (8 minutos)

Abrir tres pestañas: `/simulador`, `/` y `/wilber` (PIN `2381`). Todo se sincroniza entre ellas.

1. **Catálogo** — `/aventuras`: filtrar por dificultad; en el simulador, «Catálogo vacío» y volver a mirar.
2. **Fechas y cupos** — abrir Volcán de Santa Ana: fechas futuras, tira de boletos por salida, salidas llenas sin poder elegirse.
3. **Reserva** — elegir una salida, grupo de 3, datos, resumen, confirmar. Mostrar el boleto con código, QR, punto de encuentro, qué llevar y clima.
   Con más de 24 h para la salida, «Cancelar reserva» en el boleto (o «Cancelar» en Mi cuenta) libera los cupos y avisa al visitante y a Wilber.
4. **WhatsApp** — en el simulador, teléfono del visitante (confirmación) y teléfono de Wilber (aviso de nueva reserva). Escribirle `hoy` y `lista SA24` al bot.
5. **Sin sobreventa** — escenario «Carrera por los últimos cupos»: 12 visitantes, 2 cupos. Registro: entran las que caben, el resto se rechaza, sobreventas 0.
6. **Se llena mientras miro** — criterio «La salida se llena mientras la reviso»: la pestaña de la salida avisa sola.
7. **Cruces (el problema de los $120)** — `/wilber/cruces`: el sábado tiene a Wilber y a «La Chula» en dos salidas. Arreglar con un clic; sube el gasto evitado.
8. **Tiempo** — reloj a ×3600 o «Adelantar a la madrugada»: salen recordatorios con clima y la ubicación del punto de encuentro; el panel pasa a modo noche.
9. **App de Wilber** — `/wilber/instalar` en un teléfono: agregar a la pantalla de inicio.
10. **Integraciones** — WhatsApp real con el sandbox de Kapso (número de prueba), correos en la bandeja del simulador, mapa 3D con «Recorrer la ruta».
