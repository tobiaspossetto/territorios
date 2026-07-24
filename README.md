# Territorios — Congregación Este, SF

App de territorios de predicación (mapa vectorial MapLibre + React/Vite).

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

## Deploy

Automático vía GitHub Actions (`.github/workflows/deploy.yml`): cada push a `main`
buildea y publica en GitHub Pages. La key se toma del secret `VITE_MAPTILER_KEY`.
