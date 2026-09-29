# Territorios V2 — Congregación Este, SF

Rediseño independiente de la aplicación de territorios. Reutiliza la lógica de
mapa y Firebase de la versión actual, pero incorpora una nueva interfaz de
trabajo inspirada en los principios de SAP Fiori y adaptada a la identidad
visual existente: carbón, naranja, crema y azul suave.

La V2 se publica en el hosting principal `territorios-este-sf`, reemplazando la
interfaz anterior y conservando el mismo dominio.

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

Para compilar y publicar en Firebase Hosting:

```bash
./deploy.sh
```
