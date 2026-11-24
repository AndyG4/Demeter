# Scripts de construcción de datos

Estos scripts documentan cómo se generaron los catálogos y las capas incluidas. **No son necesarios para ejecutar la aplicación**: los archivos resultantes ya están en `src/main/resources/data`.

Requieren Node.js 22+ y Python 3. Descargas desde:

- GeoNames: `MX.zip`, `admin1CodesASCII.txt`, `admin2Codes.txt` (CC BY 4.0).
- GeoJSON estatal: `angelnmara/geojson` (agregación de límites INEGI).
- TopoJSON municipal: visor público de la Plataforma Ciudadana de Fosas (solo claves y nombres INEGI).
- Fosas por entidad y año: `data.adondevanlosdesaparecidos.org`.
- Presencia municipal: API pública `plataformaciudadanadefosas.org/api/v1/map`.

## Secuencia

```bash
node scripts/fetch-geonames.mjs
Expand-Archive _tmp/MX.zip -DestinationPath _tmp -Force
node scripts/fetch-catalog.mjs          # catálogo INEGI de 2,469 municipios
node scripts/probe-graves.mjs           # bundle público con fosas 2006-2016
node scripts/parse-graves.mjs           # extrae fosas por entidad y año
node scripts/fetch-pcdf-map.mjs         # presencia municipal (deduplicar)
python scripts/build_municipios.py      # catálogo GeoNames temporal
python scripts/build_catalogo.py        # catálogo INEGI final + capas
python scripts/build_real_dataset.py    # 133,887 registros reales anonimizados (CC0)
```

`fetch-assets.mjs` descarga Leaflet, GSAP, tipografías y el GeoJSON estatal.

## Advertencia

- `_tmp/` contiene intermedios grandes y no se versiona.
- La API de la Plataforma Ciudadana de Fosas no declara licencia. Los scripts se incluyen para auditoría y reproducción; para producción se debe solicitar autorización.
- No ejecutes estos scripts contra sitios que prohíben automatización ni para evadir captchas.
