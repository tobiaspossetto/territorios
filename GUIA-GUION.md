# Guion actualizado de la guía

## Objetivo

Explicaciones breves por acción, capturas móviles reales de la app local y datos ficticios. Uso diario primero; Administración al final y solo para cuentas autorizadas. Sin tabs de audiencia. Mantener Aprendé a usar la app / Guía de usuario y la versión del build.

## Uso diario

Formato público: 2–3 viñetas cortas por sección, seguidas por una imagen. Sin párrafos largos ni vocabulario administrativo.

1. Programa: salidas semanales con día/horario, lugar, territorio y conductor si está asignado. Tocar una fila lleva al territorio; grupos eligen su lugar.
2. Mapa: colores de asignación, bandera/punto de encuentro, etiquetas AM/PM/G y ficha para compartir. Los demás territorios siguen visibles.
3. Manzanas: acercarse para ver X aun sin ficha; no repetir las tachadas, usar las pendientes y consultar dudas.
4. Controles: lupa para salidas, arrastrar/pellizcar, brújula, ubicación con permiso, ojo y tema.
5. Campaña: botón dentro de Mapa, no pestaña separada. Al habilitarse comienza encendido. Verde + borde discontinuo = Hecho y banderas verdes. Apagar el filtro solo cambia la vista personal. Sin mencionar C al público.

Punto de encuentro: imagen del programa como fuente principal; pin como referencia complementaria.

## Administración

1. Registros: filtros, alta, Inicio/Fin, manzanas disponibles, tilde de fila vs Guardar cambios. Exportación S-13 actual, S-13 anterior y Excel. Interruptores de visibilidad.
2. Programa: guardado automático público, grupos cualquier día, unir G1/G2, varios territorios/primero para bandera, dirección y centro alternativo. Ocultar bandera por lugar sin borrar fila, descarga PNG y Resetear.
3. Pines y tareas: lápiz y arrastre, misma ubicación con varias banderas, guardado individual, Deshacer 8 s. Minimizar y retomar la pestaña/estado mediante barra inferior.
4. Métrica: inicia comprimida, expansión lateral, referencia visible Año de servicio/Historial completo, distribución, zonas y promedio. Paleta independiente de Programa.
5. Campaña, antes de Accesos: habilitación general vs filtro personal, Inicio/Fin y C. Al deshabilitar desaparece el botón, vuelve el mapa habitual, se conserva el historial y se bloquea editar C. Al reactivar, filtro encendido. Restablecer sí quita las C tras confirmar; no confundir.
6. Accesos: Google autorizado, agregar/quitar, protegidos, sin correo automático, cerrar sesión. Tema único en header.

## Escenario y capturas

`?guidePreview=1` (solo desarrollo): semana ficticia de lunes a domingo con grupos G1/G2 unidos, T36/T35, NEGOCIOS sin navegación, G3 oculto del mapa y T25 activo con manzanas 2/5 tachadas. Sin suscripción a los datos públicos reales. `&adminPreview=1` agrega registros/correos ficticios y edición local sin guardar registros ni posiciones en Firebase.

Datos compartidos en src/guideDemo.js; capturas de 390 × 844 en public/guide-v3-*.jpg y public/guide-v4-*.jpg. V4 actualiza Programa, mapa compacto, búsqueda, Campaña encendida/apagada, pines, Métrica y barra para retomar. Capturadas mediante la interfaz, sin recrear pantallas ni usar registros reales. Carruseles horizontales con indicación, snap y ampliación/tamaño real; acordeones y foco de teclado.

Prueba local de Campaña: filtro personal apagado conserva elección al volver desde Programa y Métrica; no aparece en Métrica. Interruptor general apagado conserva filas/fechas/C, oculta filtro y guía pública de Campaña, bloquea C. Rehabilitar recupera edición y activa el filtro. Deshacer revierte un movimiento de prueba. Ninguna escritura en Firebase.

## Alcance

Actualización local de la guía y escenario de prueba. Sin despliegue ni cambios al programa real.
