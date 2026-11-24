# Auditoría técnica y legal de fuentes — Proyecto Demeter

**Fecha de consulta de todas las URLs: 2026-11-18** (aprox. 16:00–18:00, America/Mexico_City).
**Objeto:** verificar qué se puede ingerir de forma lícita para un observatorio de desapariciones en México.
**No contiene código de ingesta.** Documenta fuentes, estados, campos, licencias y límites.

## 0. Método y límites de esta auditoría (leer antes de confiar en la tabla)

| Aspecto | Cómo se verificó | Límite real |
|---|---|---|
| Estado HTTP | Petición HTTP directa desde este entorno, una por URL, sin ejecutar JavaScript | Solo se ve el HTML inicial; las apps SPA devuelven 200 aunque no sirvan datos |
| Cabeceras (Server, CSP, TLS) | **No verificadas** | La shell de este entorno no pudo establecer TLS con ningún host (`SEC_E_NO_CREDENTIALS`); no hay auditoría de certificados ni de cabeceras |
| PDF / ZIP | Se intentó abrir el binario | El lector no decodifica PDF/ZIP. Un error de *content-type* (`application/pdf`, `application/zip`) **confirma que el archivo existe y se sirve**; un `404`/`406` con HTML indica lo contrario. Aquí se distingue cada caso |
| Captcha | Inspección del HTML servido | Un captcha que aparece tras interacción o tras validación por JS **no puede descartarse** desde aquí |
| Figuras | Se citan solo con URL, medio y fecha de corte | El dashboard del RNPDNO es JS: sus cifras no se leyeron del sitio, se citan de fuentes que las reportan |

> Regla de oro aplicada: **la ausencia de `robots.txt` no autoriza nada**. Lo que manda son los Términos de Uso y la ley de datos personales.

## 1. Tabla maestra de fuentes

| # | Fuente | HTTP real | ¿Datos? | API/CSV descargable (URL exacta) | Campos | Cobertura | Actualización visible | Licencia / términos | robots.txt | Captcha |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | RNPDNO Dashboard `https://versionpublicarnpdno.segob.gob.mx/Dashboard/Index` | **200** | Agregados (estado, municipio, año, sexo, edad, delito) | Ninguno en el HTML; no hay botón de descarga accesible sin sesión | 450 variables declaradas; el tablero expone ~6 dimensiones | 1952–hoy (con corte histórico RNPED 30-abr-2018) | Fecha y hora de consulta por gráfica; desfase ≤5 min | Términos propios: gratis, sin registro, "buen uso", "no causar daños"; **sin licencia de reutilización** | **404 — no existe** | No observado |
| 1b | Raíz `https://versionpublicarnpdno.segob.gob.mx/` | 200 (sirve el mismo Dashboard) | — | — | — | — | — | — | 404 | No |
| 2 | Consulta por nombre/folio `https://cnbreporteinicial.segob.gob.mx/` (enlazado desde `https://cnbreportadesaparecidos.segob.gob.mx/`) | **200** | Búsqueda individual por folio, no volcado | No | Ficha por persona (no agregados) | 2019–hoy | Enlace fechado 09-06-2026 en el portal | Términos gob.mx | Catch-all (sin robots real) | No verificable |
| 3 | Búsqueda Generalizada `https://busquedageneralizada.gob.mx/` | **Sin respuesta** (fallo TCP/TLS en 5 intentos: https, http, `/consulta/`, `/robots.txt`) | Censo de la Estrategia Nacional | No verificable | — | Censo publicado 04-12-2023 | — | — | No verificable | No verificable |
| 4 | Plataforma Ciudadana de Fosas `https://plataformaciudadanadefosas.org/` | **200** (SPA; solo devuelve el título) | Sí, vía API | **`https://plataformaciudadanadefosas.org/api/v1/scatter`** (JSON, 200) | `id_ent`, `name_ent`, `name_mun`, `fiscalia_pred`, `prensa_pred` | Modelo de predicción municipal; sin campo de año | No expone fecha en la API | **Sin licencia declarada** | Permite todo + sitemap (4 URLs) | No observado |
| 4b | Metodología 2024 `https://plataformaciudadanadefosas.mx/assets/Metodologia-NotaMetodologica-2024.pdf` | **Existe** (`application/pdf`) | Documento metodológico | — | — | 2006–2024 | — | — | — | — |
| 4c | Metodología 2025 `https://plataformaciudadanadefosas.org/assets/Metodologia_PCDF_2025.pdf` | **Existe** (`application/pdf`) | Documento metodológico | — | — | 32+ solicitudes de información, 2006–2024 | — | — | — | — |
| 5 | SCJN `https://busqueda-personas.scjn.gob.mx/` | **200, pero la app responde "Ocurrió un error inesperado"** | Fichas de búsqueda (nivel persona) | No | Ficha individual | — | No visible | Sin licencia; contiene datos personales | Catch-all (sin robots real) | No verificable |
| 6 | CDMX `https://comisiondebusqueda.cdmx.gob.mx/CBP/rpd/version-publica` | **200** | **Ninguno propio**: su botón "Consulta la versión pública" apunta al dashboard del RNPDNO | No | Describe sus variables internas, no las publica | Registro interno desde jun-2019 | — | Licencia de Gobierno Abierto CDMX | **200 vacío** (permite todo) | No |
| 7 | Nayarit `https://busquedas-dev.nayarit.gob.mx/` | **200** (SPA, "Registro de personas desaparecidas") | No verificable | No | — | — | — | — | Catch-all: devuelve la SPA en `/robots.txt` | No verificable |
| 8 | Red Lupa `https://imdhd.org/redlupa/` | **200** | Informes y series por estado (WordPress) | Informe Nacional 2026: `https://imdhd.org/redlupa/wp-content/uploads/2026/05/informe-nacional-2026.pdf` | Cifras por estado, año, sexo, edad | 2000–16-may-2026 | "Actualizado: 16 de mayo de 2026" | Sin licencia explícita (financia UE/Fundación Boell) | Permite todo (Yoast, `Disallow:` vacío) en `adondevanlosdesaparecidos.org`; `imdhd.org` redirige a `www.imdhd.org` | No |
| 9 | INEGI `https://www.inegi.org.mx/temas/mg/` | **200, pero es una cáscara JS** ("Marco Geoestadístico", sin enlaces en el HTML) | Geodatos vectoriales | **`https://www.inegi.org.mx/contenidos/productos/prod_serv/contenidos/espanol/bvinegi/productos/geografia/marcogeo/889463142683_s.zip`** → HTTP **406** = **el archivo existe** y rechaza clientes que no piden ZIP | SHP con claves geoestadísticas (entidad, municipio, localidad, AGEB) | Marco Geoestadístico (varias ediciones) | Por edición | Datos abiertos INEGI (uso libre con atribución) | 200: permite `/temas`, `/datos`; prohíbe rutas de catálogo/descarga | No |
| 10 | datos.gob.mx `https://datos.gob.mx/` y su API CKAN | **403 Access Denied (Akamai)** en la raíz **y** en `/busca/api/3/action/package_search` | Catálogo (incluye RNPED histórico del SESNSP) | Bloqueado para acceso automatizado; requiere navegador | — | — | — | Términos de datos abiertos | — | **Sí: protección anti-bot de borde** |

## 2. Fichas: lo que importa de cada fuente

### 2.1 RNPDNO — versión estadística (fuente 1)
- Es la fuente **oficial y única** de agregados nacionales. Declara **450 variables**, pero el tablero público solo grafica unas seis dimensiones.
- **No hay descarga masiva.** Confirmado por dos vías: el HTML no ofrece endpoint de descarga y la literatura académica describe el RNPDNO como un registro **"sin facilidad de descarga masiva"** (dataset municipal 2015–2025, DOAJ).
- **Puerta de términos**: cualquier ruta profunda (`/Dashboard/ContextoGeneral`, `/Dashboard/Estadistica`) **redirige al aviso de términos**. Es una aceptación normal de usuario, no un control que intentemos eludir; pero implica que un cliente sin cookies nunca ve las gráficas.
- **Advertencia de calidad (decisiva para Demeter):** Data Cívica documenta que el registro cambia sin trazabilidad: **38.5% de los registros están confidencializados**, **46,742 sin datos mínimos**, y la propia autoridad sostiene que solo **43,128** siguen vigentes frente a **132,534** registradas. Cualquier serie histórica del RNPDNO **no es reproducible** entre cortes.
- El instructivo oficial de la versión pública (`http://comisionacionaldebusqueda.gob.mx/wp-content/uploads/2022/12/Instructivo-Version-Publica-RNPDNO.pdf`) menciona 25 variables consultables/descargables para personas localizadas; **no pude leer el PDF** (el lector no decodifica PDF), así que trato la descarga como *no confirmada*.

### 2.2 Búsqueda Generalizada (fuente 3) — caída desde esta red
- El dominio **resuelve** (`187.218.29.245`) pero **no completa TCP/TLS** en ninguna ruta, ni por http. No es un bloqueo por captcha: es indisponibilidad o filtrado de red.
- Contexto documentado: es el censo de la **Estrategia Nacional de Búsqueda Generalizada**, publicado el **04-12-2023** con **96,738 registros** (Data Cívica/ACNUDH); la CNB anunció en 2024 la consolidación de sus tres portales en uno.
- **Conclusión:** no es fuente ingerible hoy. Si se necesita, la vía es solicitud de transparencia, no reintentos.

### 2.3 Plataforma Ciudadana de Fosas (fuente 4)
- API pública real y funcionando: **`/api/v1/scatter`** devuelve un arreglo JSON. Valores `fiscalia_pred` y `prensa_pred` son **probabilidades 0–1**, no conteos.
- **Defecto de calidad detectado:** cada municipio aparece repetido **~6 veces** (923 filas para 153 municipios únicos en los primeros 100 KB). Hay que **deduplicar por `(id_ent, name_mun)`**; si no, cualquier mapa infla la señal ×6.
- La respuesta es grande (mi cliente la truncó a los 100 KB); no hay endpoint de metadatos ni campo temporal.
- **Licencia: no declarada.** Para reutilizar hay que pedir autorización a las organizaciones responsables (IBERO / Programa de Derechos Humanos).
- Cifras del proyecto (prensa, 2026): **+4,500 fosas clandestinas, +6,200 cuerpos, +4,600 restos**; **157 fosas y +200 cuerpos** entre enero y abril de 2026; **+72,000 cuerpos sin identificar en resguardo del Estado**.

### 2.4 SCJN (fuente 5)
- Publica **fichas de búsqueda** (carteles con nombre, foto, edad, señas). Es material de **difusión para localizar personas**, no un dataset estadístico.
- La app devolvió error en el HTML inicial; el contenido exige JS.
- **Decisión de Demeter: no se ingiere.** Sería tratamiento masivo de datos personales sensibles sin base legal de reutilización.

### 2.5 CDMX (fuente 6) — hallazgo incómodo
- La página de "Versión Pública" de la CBPCDMX **no publica datos**: su enlace "Consulta la versión pública" lleva a `versionpublicarnpdno.segob.gob.mx/Dashboard/ContextoGeneral`. Es decir, **CDMX delega en el registro nacional** y no ofrece su propio volcado.
- Publica en cambio una descripción muy útil de sus variables (sexo, edad, nacionalidad, escolaridad, estado civil, vulnerabilidad, estatus, parentesco del reportante, alcaldía/colonia, circunstancia, fuente, condición de localización) y el catálogo de **motivos de desaparición** (17 categorías). Ese catálogo sí es reutilizable como taxonomía.

### 2.6 Nayarit (fuente 7)
- El host es **`busquedas-dev`**: un subdominio de **desarrollo/staging**. Aunque responda 200, no es un canal oficial estable ni auditable. **No ingerir.**

### 2.7 Red Lupa / IMDHD (fuente 8)
- La mejor fuente **secundaria** de series por estado y por año, con metodología explícita y PDF descargable. Informe Nacional 2026 actualizado al **16-may-2026**.
- Trae el informe de **100 municipios** (`https://imdhd.org/redlupa/informes-y-analisis/cuales-son-los-100-municipios-que-con-mas-desapariciones-de-personas-en-mexico/`), sobre 2,478 municipios.
- **Cuidado:** las fichas estatales de la página muestran cifras rotuladas "a mayo 16 de 2024" mezcladas con el comparativo 2026. Hay que fijar el corte por cifra, no por página.

## 3. Cifras públicas verificables (con corte y URL)

| Cifra | Valor | Definición | Corte | URL |
|---|---|---|---|---|
| Personas desaparecidas y no localizadas (vigentes) | **132,534** | Suma de ambos estatus | 26/27-mar-2026 | https://www.elimparcial.com/mexico/2026/03/27/claudia-sheinbaum-reconoce-132-mil-desaparecidos-en-mexico-y-presenta-informe-nacional-con-reformas-512-instituciones-involucradas-y-nuevos-protocolos-de-busqueda-obligatoria/ |
| Registros históricos acumulados | **394,645** | Reportes desde 1952, no personas | mar-2026 | https://www.diariodemorelos.com/noticias/gobierno-de-m-xico-pacta-con-reclusos-sentenciados-para-buscar-los-132-mil-desaparecidos |
| Casos de "larga data" 1952–2005 | **2,356** | Subconjunto del total | mar-2026 | https://expresatv.com.mx/nacional/2026/registra-mexico-130-mil-178-personas-desaparecidas-de-2006-a-2026/ |
| Registros sin datos mínimos de identidad | **46,742** (36%) | Registros, no personas | 31-ago-2026 | https://datacivica.org/comunicado-a-quienes-nos-faltan-2026/ |
| Registros confidencializados | **38.5%** del total | Ocultos a consulta pública | 31-ago-2026 | https://datacivica.org/comunicado-a-quienes-nos-faltan-2026/ |
| Personas "realmente" vigentes según revisión oficial | **43,128** | Versión del Ejecutivo | ago-2026 | https://datacivica.org/comunicado-a-quienes-nos-faltan-2026/ |
| Total nacional (conteo ciudadano) | **+135,000** | Personas registradas | 16-may-2026 | https://imdhd.org/redlupa/informes-y-analisis/informes-nacionales/informe-nacional-de-personas-desaparecidas/ |
| Año con más casos | **12,632** en 2024 | Registros del año | 16-may-2026 | (misma URL Red Lupa) |
| Estado con más casos | **14,697** Edomex | Desaparecidas y no localizadas | 02-mar-2026 | https://www.sernoticias.com.mx/2026/03/30/el-estado-de-mexico-lidera-a-nivel-nacional-en-personas-desaparecidas-y-no-localizadas-con-mas-de-14600-casos-vigentes-segun-el-rnpdno/ |
| Fosas clandestinas documentadas | **+4,500** | Fosas, no cuerpos | 2026 | https://lopezdoriga.com/nacional/acusan-desastro-forense-mexico-falta-transparencia-fosas-clandestinas-comunes/ |
| Cuerpos y restos en fosas | **+6,200 cuerpos / +4,600 restos** | Hallazgos | 2026 | (misma URL) |
| Fosas ene–abr 2026 | **157 fosas / +200 cuerpos** | Exhumaciones del periodo | abr-2026 | https://www.meganoticias.mx/guaymas/noticia/fosas-clandestinas-revela-la-realidad-de-la-violencia-en-mexico/745111 |
| Cuerpos sin identificar en resguardo | **+72,000** | Bajo custodia del Estado | 2026 | https://prensa.ibero.mx/es-MX/nota/crisis-forense-en-mexico-deja-mas-de-72-mil-cuerpos-sin-identificar-bajo-resguardo-del-estado-plataforma-ciudadana-de-fosas-impulsada-por-ibero |
| Fosas 2006–2016 (estatales + PGR) | **1,978 + 232 fosas; 2,884 cuerpos; 24 fiscalías** | Serie histórica por estado y año | 2006–2016 | https://data.adondevanlosdesaparecidos.org/ |

**Advertencia:** estas cifras **no son sumables ni comparables entre sí** (distintos cortes, distintas unidades: personas vs. registros vs. reportes). Demeter debe publicar siempre la etiqueta de unidad y el corte.

## 4. "Desaparecidas" ≠ "no localizadas"

| Estatus | Qué significa | Implicación |
|---|---|---|
| **Desaparecida** | Persona cuya ausencia se atribuye a una **privación de la libertad** (por particulares o por servidores públicos, con o sin aquiescencia). Presunción de delito | Requiere investigación penal; es la categoría con mayor gravedad jurídica |
| **No localizada** | Persona de paradero desconocido **sin indicios de delito**: extravío, accidente, enfermedad, migración, ausencia voluntaria | No implica necesariamente un delito; suele resolverse con localización |
| **Localizada** (con/sin vida) | Se encontró a la persona | Sale del conteo vigente; explica parte de las "caídas" de cifras |
| **Confidencializada** | Registro sustraído de la consulta pública | No es un estatus de la persona, es una decisión de opacidad |

- El **RNPDNO reporta ambas juntas** ("personas desaparecidas y no localizadas"), y por eso la cifra 132,534 **no equivale** a "desaparecidas" en sentido penal.
- La LGD usa ambos conceptos y obliga a distinguir el **delito** por el cual se investiga (desaparición forzada, por particulares, secuestro, trata, reclutamiento, sustracción). El dashboard expone esa variable.
- **Para Demeter:** nunca publicar un solo número sin desagregar `estatus` (desaparecida / no localizada / localizada) y `fuente` del registro. Es la diferencia entre un dato y una afirmación política.

## 5. GeoJSON oficial de municipios (INEGI)

| Pregunta | Respuesta verificada |
|---|---|
| ¿Existe GeoJSON oficial de los 2,478 municipios? | **No.** El INEGI publica **Shapefile (SHP)** dentro del Marco Geoestadístico. No hay GeoJSON nacional publicado por INEGI |
| ¿URL directa verificada? | `https://www.inegi.org.mx/contenidos/productos/prod_serv/contenidos/espanol/bvinegi/productos/geografia/marcogeo/889463142683_s.zip` → **HTTP 406** (el archivo existe; el servidor rechaza clientes que no aceptan `application/zip`) |
| ¿Tamaño? | Del orden de **cientos de MB a ~3 GB** según edición (el archivo **no se descargó**; no se midió) |
| ¿Licencia? | Datos abiertos INEGI: **uso libre, gratuito y con atribución** al INEGI |
| ¿Cómo obtener GeoJSON? | Conversión local con `ogr2ogr` desde el SHP, filtrando nivel municipal. Es una operación legítima sobre dato abierto |
| Alternativa ya en GeoJSON | Solo agregaciones locales, p. ej. alcaldías de CDMX (GeoJSON de **755.8 KiB** según ficha CKAN de `datos.cdmx.gob.mx`) |
| Población | `https://www.inegi.org.mx/programas/ccpv/2020/` (Censo 2020, descarga en SHP/CSV/DBF) |
| Marginación | **No es INEGI: es CONAPO.** El Índice de Marginación por municipio se publica en `https://www.gob.mx/conapo`. Confundir la fuente es un error frecuente |

## 6. Sitios comparables y qué ofrecen

| Sitio | Datos | Funcionalidad | Reutilización |
|---|---|---|---|
| **Plataforma Ciudadana de Fosas** (`plataformaciudadanadefosas.org`) | Fosas, cuerpos, restos, predicción municipal | Tablero, diagnóstico forense, repositorio, **API JSON** | Sin licencia; pedir permiso |
| **Red Lupa / IMDHD** (`imdhd.org/redlupa`) | Series estatales y municipales, evaluación de la LGD | Informes PDF, mapa por estado, 100 municipios | Sin licencia explícita; citar |
| **A dónde van los desaparecidos** (`adondevanlosdesaparecidos.org`) | Periodismo de datos + `data.adondevanlosdesaparecidos.org` (#MéxicoPaísdeFosas 2006–2016) | Mapa de fosas por estado y año, series descargables por estado | Sin licencia explícita; el mapa es de 2018 |
| **Quinto Elemento Lab** (`quintoelab.org`) | Investigación periodística | Reportajes, metodologías, alianzas | Sin datasets |
| **Data Cívica** (`datacivica.org`) | Compendio *A quienes nos faltan* 2022–2026 | Análisis de calidad del RNPDNO, series de confidencialización | Referencia metodológica obligada |

## 7. Qué es viable ingerir legalmente

1. **Agregados del RNPDNO leídos y citados** (estado, municipio, año, sexo, edad, delito), con fecha y hora de consulta. Uso permitido por sus términos ("consulta gratuita, sin registro"); **no** hay licencia de reutilización masiva, así que Demeter publica agregados con atribución, nunca un volcado.
2. **API pública de la Plataforma Ciudadana de Fosas** (`/api/v1/scatter`) con deduplicación ×6, atribución visible y sin reconstruir el modelo. Antes: pedir autorización escrita por la ausencia de licencia.
3. **Marco Geoestadístico del INEGI** (SHP → GeoJSON), población del Censo 2020 y marginación de CONAPO. Dato abierto, con atribución.
4. **Informes y PDFs de Red Lupa, Data Cívica, IBERO y A dónde van los desaparecidos**, citando corte y metodología.
5. **Solicitudes de transparencia** a la CNB (Plataforma Nacional de Transparencia, `https://www.plataformadetransparencia.org.mx/`) para series agregadas por municipio y año, y para el catálogo de variables. Es la vía legítima para lo que no está publicado.
6. **Convenios de colaboración** con IBERO/Plataforma y con IMDHD para recibir sus bases con permiso expreso.

**Condiciones técnicas mínimas:** User-Agent identificable, límite de 1 req/s, caché agresiva, reintentos con backoff, y respeto a `robots.txt` cuando exista.

## 8. Qué NO haremos

1. **No evadiremos captchas** ni controles de acceso, en ninguna fuente. Si un acceso exige captcha o sesión autenticada, se documenta y se busca la vía legal.
2. **No haremos scraping agresivo** ni paralelo de los portales de gobierno; su infraestructura ya presenta caídas documentadas.
3. **No ingeriremos datos personales masivos**: fichas de búsqueda de la SCJN, nombres, folios, edades o fotos de personas desaparecidas. Sería tratamiento de datos sensibles sin base legal.
4. **No usaremos la base filtrada del RNPDNO** que circula (la que usó Data Cívica en 2026). Es información de origen ilícito; su uso comprometería al proyecto y a las familias.
5. **No presentaremos el dato de la CDMX como propio**: su "versión pública" no publica nada; solo enlaza al RNPDNO.
6. **No usaremos `busquedas-dev.nayarit.gob.mx`**: es un entorno de desarrollo, no una fuente oficial.
7. **No publicaremos un total único** sin desagregar por estatus, unidad y corte.
8. **No eludiremos el bloqueo anti-bot de `datos.gob.mx`** (403 Akamai). Se usará navegador manual y descarga directa del archivo.

## 9. Bitácora de verificación (2026-11-18)

| URL probada | Resultado |
|---|---|
| `https://versionpublicarnpdno.segob.gob.mx/Dashboard/Index` | 200 · aviso de términos |
| `https://versionpublicarnpdno.segob.gob.mx/` | 200 · mismo contenido |
| `https://versionpublicarnpdno.segob.gob.mx/robots.txt` | **404** |
| `https://versionpublicarnpdno.segob.gob.mx/Dashboard/Estadistica` | 200 · redirige al aviso de términos |
| `https://busquedageneralizada.gob.mx/` (https, http, `/consulta/`, `/robots.txt`) | **fallo de conexión en 5 intentos** (DNS sí resuelve) |
| `https://plataformaciudadanadefosas.org/` | 200 · SPA |
| `https://plataformaciudadanadefosas.org/robots.txt` | 200 · `Allow: /` + sitemap |
| `https://plataformaciudadanadefosas.org/api/v1/scatter` | **200 JSON** · 923 filas / 153 municipios en 100 KB |
| `https://plataformaciudadanadefosas.org/assets/Metodologia_PCDF_2025.pdf` | existe (`application/pdf`) |
| `https://plataformaciudadanadefosas.mx/assets/Metodologia-NotaMetodologica-2024.pdf` | existe (`application/pdf`) |
| `https://busqueda-personas.scjn.gob.mx/` | 200 · "Ocurrió un error inesperado" |
| `https://comisiondebusqueda.cdmx.gob.mx/CBP/rpd/version-publica` | 200 · sin datos propios |
| `https://comisiondebusqueda.cdmx.gob.mx/robots.txt` | 200 vacío |
| `https://busquedas-dev.nayarit.gob.mx/` y `/robots.txt` | 200 · SPA en ambas rutas |
| `https://imdhd.org/redlupa/` | 200 · WordPress |
| `https://www.inegi.org.mx/temas/mg/` y `/temas/mg/default.html` | 200 · cáscara JS |
| `https://www.inegi.org.mx/.../marcogeo/889463142683_s.zip` | **406** · el archivo existe |
| `https://www.inegi.org.mx/.../marco_geoestadistico/794551163061_s.zip` | 200 con "Página no encontrada" · **liga muerta** |
| `https://datos.gob.mx/` y `/busca/api/3/action/package_search` | **403 Akamai** |
| `https://cnbreportadesaparecidos.segob.gob.mx/` | 200 · enlace a Registro Inicial |
| `https://cnbreporteinicial.segob.gob.mx/` | 200 · SPA |
| `https://www.plataformadetransparencia.org.mx/` | vía legal para solicitudes |

---
*Auditoría realizada para Demeter. Toda cifra debe citarse con su URL y su corte; toda ausencia de licencia debe tratarse como "sin permiso", no como "permiso implícito".*

