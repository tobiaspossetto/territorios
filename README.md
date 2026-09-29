# Territorios V2 — Congregación Este, SF

Rediseño independiente de la aplicación de territorios. Reutiliza la lógica de
mapa y Firebase de la versión actual, pero incorpora una nueva interfaz de
trabajo inspirada en los principios de SAP Fiori y adaptada a la identidad
visual existente: carbón, naranja, crema y azul suave.

La V2 tiene configurado un sitio de Firebase separado
(`territorios-este-sf-v2`) para impedir que un despliegue accidental reemplace
la aplicación original.

## Desarrollo

```bash
npm install
npm run dev
```

Requiere `.env` con la key de MapTiler:

```
VITE_MAPTILER_KEY=tu_key
```

## Datos

Los datos salen de `../generar_mapa.py` (lee `Territorios.xlsx` + KML de manzanas)
y se escriben en `public/` como `territorios.geojson`, `manzanas.geojson`, `meta.json`.

Para actualizar: correr el script y commitear los `public/*.geojson`.

## Compilación

```bash
npm run build
```

El despliegue de esta V2 debe configurarse de forma independiente. No utiliza
el hosting de producción de la aplicación original.
