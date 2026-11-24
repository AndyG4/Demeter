# Arquitectura

## 1. Principios

1. **Package by feature.** Cada capacidad (búsqueda, catálogo, datos, geo, predicciones) contiene su controlador, servicio, modelos y pruebas. `shared` sólo contiene primitivas transversales.
2. **Superficie mínima.** Sin login, sin base de datos, sin endpoints de escritura, sin CORS, sin terceros en el navegador.
3. **Instantáneas inmutables.** El índice y el modelo se construyen una vez por versión de datos y se reemplazan completos. Una búsqueda nunca ve un índice a medio construir.
4. **Complejidad explícita.** Los algoritmos están acotados y documentados; el camino normal no recorre los N registros.
5. **Honestidad del modelo.** El baseline es un rival, no un trámite. Si Random Forest no lo supera, se publica el baseline y se reporta el resultado negativo.

## 2. Estructura

```
src/main/java/mx/rastro
├── DemeterApplication.java
├── shared
│   ├── config/DemeterProperties.java
│   ├── error/{ApiException,ApiError,GlobalExceptionHandler}.java
│   ├── ratelimit/{RateLimitFilter,TokenBucketRateLimiter}.java
│   ├── text/{TextNormalizer,DamerauLevenshtein,SpanishPhonetic}.java
│   ├── util/{Csv,Haversine}.java
│   └── web/{RequestIdFilter,SecurityHeadersFilter}.java
└── features
    ├── catalog/{Catalog,CatalogLoader,Municipality,State}.java
    ├── dataset/{DatasetService,DatasetSnapshot,DatasetManifest,DatasetController,HealthController}.java
    ├── records/{PersonRecord,RecordStatus,RecordsLoader,DemoRecordsFactory}.java
    ├── search/{SearchIndex,SearchService,SearchController,SearchHit,SearchResponse,FuzzyMatcher}.java
    ├── geo/{GeoJsonService,GeoController}.java
    └── predictions
        ├── {PredictionService,PredictionController,PredictionDataLoader,PredictionCell,ModelReport,ClustersResponse}.java
        └── ml/{RandomForestClassifier,KMeans,SpatialGraph,Metrics,ModelFactory}.java
```

### Patrones

| Patrón | Dónde | Por qué |
|---|---|---|
| Singleton | Beans de Spring: `SearchIndex`, `DatasetService`, `PredictionService`, `TokenBucketRateLimiter` | Una única instantánea coherente por proceso; estado compartido con reemplazo atómico. |
| Factory | `ModelFactory` | Fija hiperparámetros de validación y producción en un solo lugar. |
| Strategy implícita | M0 / M1 / M2 en `PredictionService` | Tres formas de puntuar; se elige con la misma validación y se reporta el perdedor. |
| Immutable snapshot | `DatasetSnapshot`, `IndexSnapshot`, `ModelBundle` | Lectores sin locks; actualización por `AtomicReference`. |
| Filter chain | `RequestIdFilter` → `SecurityHeadersFilter` → `RateLimitFilter` | Defensa en profundidad sin acoplar controladores. |

## 3. Flujo de datos

```
classpath:data/estados.csv ─┐
classpath:data/municipios.csv ─┤
classpath:data/estados.geo.json ─┤
                                 ├─> DatasetService ─> DatasetSnapshot (versión, catálogo, registros)
./data/registros.csv (opcional) ─┘                         │
                                                           ├─> SearchIndex.ensure(snapshot)
                                                           └─> PredictionService.ensure(snapshot)
```

- Si no hay `./data/registros.csv` externo, se carga la base combinada 2025 + abril 2026 (`registros_combinados.csv.gz`, 137,583 personas únicas (133,887 + 3,696)). Si existe `./data/registros_nombres.csv`, se usa sólo para el buscador (78,684 nombres, sin municipio). Si tampoco existe, se genera el conjunto sintético de respaldo.
- `manifest.json` aporta versión, corte, fuente y bandera `synthetic`.
- El hash SHA-256 del archivo forma parte de la versión si no hay `version` explícita.
- `DatasetService` revisa `mtime` cada cinco minutos y publica un `DatasetChangedEvent`; el índice y el modelo se reconstruyen de forma perezosa en la siguiente petición.

## 4. Búsqueda difusa

### 4.1 Normalización

`TextNormalizer.normalize` aplica NFD, elimina marcas diacríticas, convierte a minúsculas, reemplaza todo lo que no sea `[a-z0-9]` por espacio y colapsa espacios. `"MARÍA  NÚÑEZ"` y `"maria nunez"` producen la misma cadena.

### 4.2 Índice

`SearchIndex` construye, para cada registro:

- **tokens** del nombre normalizado;
- **postings por token** exacto;
- **postings por trigrama** de cada token (`#token#`), con tope de 20,000 por clave;
- **postings por clave fonética** española (b/v, s/z/c, j/g, h muda).

La construcción es `O(N · L)` en tiempo y espacio, con `N` registros y `L` longitud media del nombre. Los trigramas se omiten si `N > 80,000` para acotar memoria; en ese caso se usan token y fonética.

### 4.3 Consulta

1. Se normaliza y tokeniza la consulta.
2. Se acumulan candidatos desde token exacto (peso 8), fonética (peso 2) y trigramas (peso 1).
3. Los candidatos se acotan a 4,000 por conteo. Si hay menos de 12, se hace una lectura lineal acotada (caso raro, no el camino normal).
4. Cada candidato se verifica con `FuzzyMatcher`: distancia de Damerau-Levenshtein por token, umbral dependiente de longitud, cobertura de tokens y peso por longitud.
5. Se mantiene un heap de tamaño `limit` y se ordena por score y luego por fecha.

Complejidad típica: `O(C · L² + k log k)`, con `C ≤ 4,000` candidatos y `k ≤ 25` resultados. No es `O(N)` sobre 78,684 nombres ni sobre 137,583 registros. La búsqueda por nombre se deshabilita si no hay capa de nombres.

### 4.4 Privacidad de la búsqueda

- Mínimo 3 letras, máximo 80.
- Sólo letras, espacios, puntos, guiones y apóstrofos.
- Máximo 25 resultados.
- Límite de 30 búsquedas por minuto por IP.
- Sin endpoint de listado, exportación o paginación profunda.

## 5. Priorización territorial

### 5.1 Datos

- 2,469 municipios con clave INEGI, coordenadas y población aproximada.
- 145 filas entidad-año de fosas (2006-2016), 1,957 fosas.
- 788 municipios con presencia documentada (2006-2024).

### 5.2 Variables

`log(población)`, latitud, longitud, `log(1+fosas de la entidad)`, tasa de fosas por 100 mil, distancia al centro de la entidad, distancia a la frontera norte, `log(número de municipios)` y `log(población de la entidad)`.

### 5.3 Modelos

| ID | Modelo | Cálculo |
|---|---|---|
| M0 | Persistencia histórica | Tasa de fosas de la entidad × población municipal |
| M1 | KDE espacial | Suma de núcleos gaussianos (120 km) desde centroides estatales ponderados por fosas |
| M2 | Random Forest | 180 árboles, profundidad 12, hoja mínima 4, cortes histogramáticos de 16 bins |

### 5.4 Validación

Ocho folds por entidad: se entrenan 28 entidades y se prueban 4. Métricas por fold: AUC, AP, precisión @10%, lift @10%, Brier. Se reportan los ocho resultados, no un promedio que oculte dispersión.

### 5.5 Selección

El baseline es el rival. M2 sólo se publica si su AP supera en 5% relativo al mejor baseline. En la ejecución de referencia, M0 obtuvo AP 0.749 y M2 0.745; se publica M0. El reporte conserva M2 y su probabilidad por municipio como contraste.

### 5.6 Clustering y grafo

- K-means (k=5) sobre perfiles estandarizados: población, latitud, longitud, tasa histórica y distancia a la frontera.
- Grafo kNN (k=6) sobre centroides municipales; componentes conexas mutuas como comunidades geográficas.
- Los grupos describen perfiles, no motivaciones delictivas.

## 6. Frontend
### 6.1 Atomic design

```
static/js
├── atoms          icon, badge
├── molecules      result-card
├── organisms      header, hero, explorer, model-section, data-section, method-section, footer
├── pages          home
├── utils          dom, format, motion
├── api.js         cliente HTTP
├── store.js       estado global mínimo
├── map.js         Leaflet sin capa base
├── animations.js  GSAP + ScrollTrigger
└── main.js        arranque y carga de datos
```

`pages/home.js` compone los organismos; `main.js` hidrata estadísticas, geometría, predicciones y modelo. No hay framework, bundler ni paso de compilación: son módulos ES6 servidos por Spring.

### 6.2 Mapa

- Leaflet 1.9.4 vendorizado, sin tiles externos.
- GeoJSON estatal con relleno por conteo o prioridad.
- Capa **Personas**: un círculo por municipio con conteo agregado; el tamaño crece con el número de registros y el tooltip desglosa tasa por 100 mil y grupo de edad. Al seleccionar una entidad se filtran los círculos y los puntos de fosas; el filtro se limpia al deseleccionar.
- Capa **Posibles fosas**: prioridad municipal y fosas esperadas por el modelo; los estados se atenúan para no convertir la prioridad en una mancha de alarma.
- **Complejidad del mapa**: agregados `O(N + M)`; perfil de edad `O(7M)`; filtro estatal `O(M)`; ordenamiento de municipios `O(M log M)`. No hay escaneos de nombres para pintar el mapa.
- **Mapa base**: OpenStreetMap (estándar) y Esri World Topo Map (relieve), con atribución; se cambia sin recargar.
- Marcadores SVG para resultados de búsqueda, dispersos de forma determinista alrededor del centroide municipal.
- Graticule propio; controles de zoom y escala.
- Sin peticiones a terceros: CSP `connect-src 'self'` e `img-src 'self' data:`.

### 6.3 Animación

GSAP + ScrollTrigger para la entrada del hero, contadores y aparición de resultados. `prefers-reduced-motion` desactiva toda animación y los elementos quedan visibles.

### 6.4 Responsive

- ≥ 981 px: hero a dos columnas, workspace panel + mapa.
- 821-980 px: hero y secciones a una columna.
- ≤ 820 px: workspace en tres filas (buscador, mapa, resultados), menú móvil, ficha como bottom sheet.
- ≤ 640 px: tipografía y espaciado reducidos; sin overflow horizontal.

## 7. Actualización y coherencia

1. Llega un archivo nuevo o cambia `mtime`.
2. `DatasetService.load()` valida el CSV y crea una instantánea nueva.
3. Se publica `DatasetChangedEvent`.
4. `SearchIndex.ensure` y `PredictionService.ensure` detectan la versión distinta y reconstruyen.
5. Las peticiones en curso terminan con la instantánea anterior; las nuevas usan la nueva.

No hay bloqueo de lectura: `AtomicReference` publica la instantánea completa. La reconstrucción está sincronizada para evitar trabajo duplicado.

## 8. Decisiones y costos

| Decisión | Beneficio | Costo |
|---|---|---|
| Sin base de datos | Menos superficie, cero SQL injection, arranque simple | No escala horizontal sin compartir instantánea |
| Índice en memoria | Consultas de milisegundos | RAM proporcional a N·L |
| Sin tiles | Privacidad, offline, estética editorial | Sin detalle geográfico de calles |
| Modelo en Java | Un solo runtime, reproducible | Menos ecosistema que Python |
| Base anonimizada abril 2026 | No expone nombres; 137,583 personas únicas (133,887 + 3,696) | No permite búsqueda por nombre |
| Demo sintética de respaldo | Desarrollo sin red | No debe presentarse como real |
| Cache estático 1 h | Menos carga | Un cambio de JS puede tardar en propagarse; en producción usar hash de contenido |

## 9. Pruebas

27 pruebas: normalización, distancia de edición, ranking, paginación, índice, métricas, Random Forest, catálogo, importador de datos reales, ubicación aproximada, rate limit, cabeceras e integración HTTP. `mvn -o test`.

## 10. Referencias internas

- [`SEGURIDAD.md`](SEGURIDAD.md)
- [`DATOS.md`](DATOS.md)
- [`MODELOS_ML.md`](MODELOS_ML.md)
- [`API.md`](API.md)




