# Rediseño reversible · 25/10/2026

- Hosting: `territorios-este-sf`.
- Versión live anterior: `76e9599b5e5a8b10` (24/10/2026).
- Copia de Hosting anterior: canal `before-redesign-20261025`.
- Canal de respaldo disponible hasta el 01/11/2026, 14:39 UTC; la versión anterior también queda en el historial de live.
- Versión nueva publicada y verificada: `0808f22426adea0f`.
- Copia local de fuentes antes de promover: `/private/tmp/territorios-before-redesign-promotion-20261025.tgz`.

## Revertir solo la interfaz

Cambiar `REDESIGN_ENABLED` a `false` en `src/interfaceRelease.js`, compilar y publicar solo Hosting.
`App` y `PublicProgram` originales siguen disponibles. Los estilos nuevos están
limitados a la clase de presentación del rediseño; no afectan a la interfaz anterior
al desactivar el flag. `PublishedApp` se importa directamente para montar la
bienvenida con video sin una pantalla intermedia de texto.

## Restaurar exactamente la publicación anterior

Mientras exista el canal de respaldo, clonar `territorios-este-sf:before-redesign-20261025`
a `territorios-este-sf:live`. La consola de Hosting también conserva el release anterior
con la versión indicada arriba.

No hubo migración de datos ni cambios de reglas, permisos o documentos de Firestore.
`PublishedApp` solo habilita presentación; los datos ficticios siguen detrás del
preview exclusivo de desarrollo. No restaurar todo el árbol Git: contiene trabajo previo.
