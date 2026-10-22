# Decisiones de diseño

## Dirección

Se repartieron tres direcciones del estudio de 247 sitios de galerías (One Page Love, Awwwards) con el script de la skill *taste* (`.taste-skill/direction.json`, semilla 411408874):

1. **La página es el objeto** (elegida): el sitio se arma como la papelería del negocio.
2. El lugar como protagonista: una foto de pantalla completa. Descartada: cualquier operador de El Salvador usa la misma foto del cráter.
3. Fotografías de distintos tamaños, tipo galería. Descartada: no tenemos fotos propias.

**Idea:** cada salida es una tira de boletos de papel, uno por asiento del microbús de 14. Cada reserva arranca boletos de la tira; lo que queda es la disponibilidad. Responde al problema real de Wilber (cruces de grupos y microbús) y no funciona igual para otro operador. Componente: `BoletoStrip`.

## Paleta y tipografía

- Rechazadas por el usuario: verde botella con dorado y la serif STIX («muy AI slop»).
- Elegidas: dos tintas, **cobalto `#062b8a` sobre arena `#e6dbc7`**, como un boleto impreso. El azul es el de la bandera. Rojo de sello `#c4352a` solo para «Llena» y errores.
- **Barlow / Barlow Condensed**: grotesca de esquinas levemente redondeadas inspirada en la señalización vial y de transporte; coincide con el trazo de puntas redondas de la W del logo.
- Todo vive en variables de `src/app/globals.css`: cambiar la paleta es editar un archivo.

## Logo

Un boleto con muescas laterales; la W es el perfil de un sendero: baja de Cerro Verde, sube al Izalco, baja y vuelve a subir.

## Reglas aplicadas

- Texto: solo datos útiles (fecha, hora, precio, lugar, qué llevar). Sin slogans ni adjetivos.
- Sin degradados, sin sombras en reposo, sin líneas finas, sin etiquetas pequeñas en mayúsculas sobre títulos, sin emoji, sin monoespaciada.
- Bordes de papel reales: dentado, zigzag, muescas de boleto, línea perforada.
- Movimiento según Emil Kowalski: curvas `ease-out` fuertes, interfaz ≤ 300 ms, presionar = escala 0.97, sin animar desde escala 0, alternativa para `prefers-reduced-motion`.
- Vidrio: solo la barra *Liquid Glass* que pidió el usuario (barra inferior en el teléfono, selector de dificultad y velocidad del simulador).
- El panel de Wilber usa la misma Barlow: arena de día y cobalto de 6 p. m. a 5:30 a. m., porque sale a las 4:30 a. m.
