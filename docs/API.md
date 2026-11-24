# API

Base: `/api/v1`. Todas las respuestas son JSON salvo el GeoJSON (`application/geo+json`). No hay autenticación ni endpoints de escritura.

## Límites

- 120 solicitudes/minuto por IP en general.
- 30 búsquedas/minuto por IP.
- Respuesta `429` con `Retry-After: 60`.
- `Cache-Control: no-store` en APIs.
- `X-Request-Id` en todas las respuestas.

## GET `/stats`

Conteos y metadatos del conjunto cargado.

```json
{
  "registros": 137583,
  "desaparecidas": 118039,
  "noLocalizadas": 6,
  "localizadas": 0,
  "confidenciales": 2823,
  "conMunicipio": 100061,
  "sinMunicipio": 20807,
  "municipiosConRegistros": 1520,
  "municipios": 2469,
  "estados": 32,
  "corte": "2026-04-30",
  "ultimaFechaMapa": "2026-04-04",
  "ultimaFechaNombres": "2023-08-20",
  "sintetico": false,
  "nombresDisponibles": true,
  "fuente": "RNPDNO · base 2025 + abril 2026 (Data Cívica, anonimizada)",
  "version": "combinado-2026"
}
```

`nombresDisponibles=true` indica que hay una capa de nombres (Data Cívica o CSV autorizado). La búsqueda devuelve precisión estatal si la fuente no publica municipio; sin capa de nombres, `/search` devuelve `400 busqueda_no_disponible`.

## GET `/search`

Sólo funciona si el conjunto cargado tiene nombres (`nombresDisponibles=true`). La base municipal de abril 2026 es anónima; si no hay capa de nombres, responde `400 busqueda_no_disponible`.

| Parámetro | Tipo | Obligatorio | Regla |
|---|---|---|---|
| `q` | texto | Sí | 3-80 caracteres; letras, espacios, punto, guion, apóstrofo |
| `limit` | entero | No | 1-100; por defecto 25 |
| `offset` | entero | No | 0-2000; por defecto 0 |
| `estado` | texto | No | Clave de entidad de 2 dígitos |
| `estatus` | texto | No | `desaparecida` o `localizada` |
| `anio` | entero | No | 1900-2100 |

```bash
curl -s "http://localhost:8080/api/v1/search?q=MARIA%20FERNANDA&limit=3"
```

```json
{
  "consulta": "MARIA FERNANDA",
  "normalizada": "maria fernanda",
  "total": 6,
  "mostrados": 3,
  "ms": 4,
  "sintetico": false,
  "resultados": [
    {
      "id": "D005281",
      "nombre": "MARIA GUADALUPE CALVILLO PEREZ",
      "edad": 36,
      "sexo": "Mujer",
      "fechaVisto": "2019-12-11",
      "estatus": "DESAPARECIDA",
      "estatusEtiqueta": "Desaparecida",
      "condicion": null,
      "municipioId": "",
      "municipio": "Sin municipio público",
      "estadoId": "01",
      "estado": "Aguascalientes",
      "lat": 21.9346,
      "lon": -102.3204,
      "precisionUbicacion": "estado",
      "fuente": "Data Cívica / RNPDNO · nombres públicos",
      "sintetico": false,
      "folio": "N47013-1",
      "score": 1.0,
      "coincidencia": "Alta"
    }
  ]
}
```

`coincidencia` es cualitativa: `Exacta` sólo si el nombre completo normalizado coincide; `Alta`, `Aproximada` o `Baja` en el resto.

`precisionUbicacion` vale `municipio` si se dispersó alrededor del centroide municipal, `estado` si la fuente sólo publica entidad y `sin_ubicacion` si no se pudo resolver. La API pública no devuelve coordenadas exactas.

### Errores de búsqueda

| Código | HTTP | Causa |
|---|---|---|
| `consulta_vacia` | 400 | `q` vacío |
| `consulta_corta` | 400 | Menos de 3 letras normalizadas |
| `consulta_larga` | 400 | Más de 80 caracteres |
| `consulta_invalida` | 400 | Caracteres fuera de la allowlist |
| `estado_invalido` | 400 | Entidad inexistente |
| `anio_invalido` | 400 | Año fuera de rango |
| `limite_excedido` | 429 | Rate limit |

## GET `/geo/estados`

GeoJSON de 32 entidades enriquecido:

```json
{
  "type": "Feature",
  "properties": {
    "name": "Aguascalientes",
    "estadoId": "01",
    "registros": 502,
    "desaparecidas": 276,
    "localizadas": 0,
    "confidenciales": 226,
    "poblacion": 1057384,
    "tasaPor100k": 47.48,
    "gruposEdad": {"0-11": 4, "12-17": 8, "18-29": 60, "30-44": 67, "45-59": 23, "60+": 5, "Sin dato": 335},
    "prioridad": 66.1,
    "fosasEsperadas": 1.5
  }
}
```

- `Content-Type: application/geo+json`.
- `ETag` y `Cache-Control: public, max-age=300`.
- `If-None-Match` devuelve `304`.
- `fosasEsperadas` es la suma municipal estimada por el modelo. No es un conteo de fosas localizadas.
- `tasaPor100k` es una tasa cruda por habitantes, no una probabilidad individual.
- `gruposEdad` usa los rangos `0-11`, `12-17`, `18-29`, `30-44`, `45-59`, `60+`, `Sin dato`.
- La fuente abierta no incluye personas localizadas; `localizadas` es 0.

## GET `/geo/municipios`

Conteos agregados por municipio. No incluye nombres.

```json
[
  {
    "municipioId": "01001",
    "municipio": "Aguascalientes",
    "estadoId": "01",
    "estado": "Aguascalientes",
    "lat": 21.88333,
    "lon": -102.3,
    "poblacion": 723043,
    "registros": 165,
    "desaparecidas": 160,
    "noLocalizadas": 5,
    "localizadas": 0,
    "confidenciales": 0,
    "tasaPor100k": 22.82,
    "gruposEdad": {"0-11": 0, "12-17": 0, "18-29": 1, "30-44": 2, "45-59": 0, "60+": 0, "Sin dato": 3}
  }
]
```

- Devuelve 2,469 municipios; los que no tienen registros aparecen en cero.
- Filtro opcional `?estado=01`.
- No expone fichas ni nombres.

## GET `/geo/municipios/{id}/registros`

Registros anonimizados de un municipio, máximo 100. No incluye nombre. Parámetros: `limit` (1-100) y `estatus` (`desaparecida`, `no_localizada`, `localizada`, `confidencial`).

```json
[
  {
    "id": "D49C001E-41E4-45B7-B8FD-D867578F093E",
    "folio": "ID-D49C001E",
    "sexo": "Hombre",
    "edad": 25,
    "fecha": "2025-09-18",
    "estatus": "DESAPARECIDA",
    "estatusEtiqueta": "Desaparecida",
    "fuente": "RNPDNO · base 2025 + abril 2026 (Data Cívica, anonimizada)",
    "origenReporte": "FISCALIA GENERAL DEL ESTADO DE AGUASCALIENTES"
  }
]
```

## GET `/predictions`

| Parámetro | Tipo | Regla |
|---|---|---|
| `estado` | texto | Clave de 2 dígitos |
| `limit` | entero | 0-2500; 0 = todas |

```json
{
  "modelo": "m0",
  "objetivo": "Presencia documentada de fosas clandestinas por municipio (2006-2024)",
  "advertencia": "...",
  "versionDatos": "combinado-2026",
  "celdas": 2,
  "resultados": [
    {
      "municipioId": "08037",
      "municipio": "Juárez",
      "estadoId": "08",
      "estado": "Chihuahua",
      "lat": 31.6904,
      "lon": -106.4245,
      "poblacion": 1321000,
      "presenciaDocumentada": 1,
      "fosasEsperadas": 64.3,
      "indice": 1.0,
      "probabilidadRf": 0.95,
      "kde": 0.88,
      "prioridad": 100.0,
      "banda": "A",
      "cluster": 0,
      "clusterNombre": "Alta incidencia histórica",
      "comunidad": 0,
      "factores": ["Tasa histórica alta en la entidad", "Cercanía a la frontera norte"]
    }
  ]
}
```

`indice` es el score del modelo publicado, normalizado 0-1. `probabilidadRf` es la probabilidad de Random Forest, aunque no sea el modelo publicado. `fosasEsperadas` es una estimación del modelo (tasa histórica de la entidad × población municipal), no un conteo de fosas localizadas.

## GET `/models`

Reporte de validación:

```json
{
  "objetivo": "...",
  "versionDatos": "combinado-2026",
  "modeloSeleccionado": "m0",
  "municipios": 2469,
  "positivos": 788,
  "prevalencia": 0.319,
  "modelos": [
    {"id": "m0", "auc": 0.823, "ap": 0.749, "precision10": 0.849, "lift10": 2.52, "seleccionado": true},
    {"id": "m1", "auc": 0.562, "ap": 0.457, "precision10": 0.494, "lift10": 1.39, "seleccionado": false},
    {"id": "m2", "auc": 0.816, "ap": 0.745, "precision10": 0.859, "lift10": 2.62, "brier": 0.167, "seleccionado": false}
  ],
  "folds": [],
  "importancia": {},
  "temporal": {}
}
```

## GET `/clusters`

```json
{
  "metodo": "K-means (k=5) + componentes conexas de un grafo kNN (k=6)",
  "advertencia": "Los grupos describen perfiles geográficos...",
  "clusters": [
    {"id": 0, "nombre": "Alta incidencia histórica", "municipios": 354, "poblacion": 12000000, "tasaFosas": 3.04, "estados": ["Chihuahua", "Sonora"]}
  ],
  "comunidades": [
    {"id": 0, "municipios": 432, "lat": 24.1, "lon": -104.2, "estados": ["Durango", "Zacatecas"]}
  ]
}
```

## GET `/dataset`

```json
{
  "version": "combinado-2026",
  "fuente": "RNPDNO · base 2025 + abril 2026 (Data Cívica, anonimizada)",
  "sintetico": false,
  "corte": "2026-04-30",
  "registros": 137583,
  "cargadoEn": "2026-11-18T22:30:20Z"
}
```

## GET `/health`

```json
{"status":"ok","datasetVersion":"combinado-2026","records":137583,"now":"2026-11-18T22:30:26Z"}
```

## Formato de error

```json
{
  "code": "consulta_corta",
  "message": "Escribe al menos 3 letras del nombre.",
  "requestId": "029c92f2970cd44b"
}
```

No se devuelven trazas ni detalles internos.

## CORS y CSRF

- Sin CORS: el navegador sólo puede llamar desde el mismo origen.
- Sin cookies ni sesiones: no hay CSRF explotable.
- Sin endpoints `POST`, `PUT`, `PATCH` ni `DELETE`.

## Ejemplos de verificación

```bash
curl -sI http://localhost:8080/ | grep -i content-security-policy
curl -s http://localhost:8080/api/v1/geo/estados | jq '.features | length'
curl -s "http://localhost:8080/api/v1/search?q=a" | jq
curl -s "http://localhost:8080/api/v1/predictions?limit=5" | jq '.resultados[].municipio'
```









