# Datos

## 1. Principio

Un registro no es una persona. Una fosa no es un cuerpo. Un conteo no es una serie comparable. Demeter conserva **unidad, corte y fuente** en cada capa y evita sumar universos distintos.

## 2. Fuentes

| Fuente | Qué se usa | Cobertura | Licencia / condición | Enlace |
|---|---|---|---|---|
| RNPDNO, versión estadística | Definiciones, contexto, criterios de estatus | Agregados; 1952-hoy con cortes variables | Términos de gob.mx; sin descarga masiva; sin licencia de reutilización explícita | https://versionpublicarnpdno.segob.gob.mx/ |
| RNPDNO · base 2025 + abril 2026 (Data Cívica, anonimizada) | Personas, sexo, edad, fecha, estatus, entidad y municipio | 137,583 personas únicas; corte 2026-04-30 | Pública, anonimizada, sin licencia de reutilización explícita | https://datacivica.org/a-quienes-nos-faltan-2026/los-otros-datos/ |
| Data Cívica · nombres públicos | Búsqueda por nombre, entidad | 78,684 registros; sólo entidad | Pública, sin licencia de reutilización explícita; se incluye en la imagen pública | https://volveradesaparecer.datacivica.org/datos-abiertos |
| A dónde van los Desaparecidos (Quinto Elemento Lab) | Fosas por entidad y año | 2006-2016; 1,957 fosas en filas válidas | Sin licencia explícita; uso periodístico/cívico con atribución | https://data.adondevanlosdesaparecidos.org/ |
| Plataforma Ciudadana de Fosas (Artículo 19, Data Cívica, IBERO, PDH) | Presencia documentada por municipio | 2006-2024; 788 municipios | **Sin licencia declarada**; API pública. Para producción se requiere autorización | https://plataformaciudadanadefosas.org/ |
| INEGI | Límites estatales, claves municipales | 32 entidades, 2,469 municipios | Datos abiertos INEGI; atribución | https://www.inegi.org.mx/ |
| GeoNames | Coordenadas y población aproximada de municipios | 2,471 registros base | CC BY 4.0 | https://www.geonames.org/ |

### Advertencia de licencia

La API de la Plataforma Ciudadana de Fosas **no declara licencia**. En esta demostración se usa únicamente como etiqueta agregada de validación (presencia sí/no por municipio), no se redistribuyen sus predicciones ni sus microdatos. Antes de un despliegue público se debe solicitar autorización a las organizaciones responsables o sustituir la etiqueta por un convenio propio.

El RNPDNO no ofrece descarga masiva. Demeter **no** automatiza su captcha ni su puerta de términos. Las cifras oficiales se citan como contexto, no se ingieren como padrón.

## 3. Definiciones que no se deben mezclar

| Término | Significado | Implicación |
|---|---|---|
| Desaparecida | Ausencia atribuida a privación de la libertad (pública o privada) | Presunción de delito; investigación penal |
| No localizada | Paradero desconocido sin indicios de delito | Puede resolverse con localización |
| Localizada | Persona encontrada, con o sin vida | Sale del conteo vigente |
| Confidencializada | Registro sustraído de la consulta pública | Decisión de opacidad, no estatus de la persona |
| Fosa | Sitio de inhumación | No equivale a cuerpo ni a víctima identificada |

El RNPDNO reporta “personas desaparecidas y no localizadas” juntas. Por eso **132,534 no equivale a 132,534 desapariciones forzadas**.

## 4. Calidad del registro

Cifras públicas verificables (no sumables entre sí):

| Cifra | Valor | Unidad | Corte | Fuente |
|---|---:|---|---|---|
| Personas desaparecidas y no localizadas vigentes | 132,534 | registros/personas según autoridad | mar-2026 | El Imparcial, 27-mar-2026 |
| Personas realmente vigentes según revisión oficial | 43,128 | personas | ago-2026 | Data Cívica |
| Registros confidencializados | 38.5% | registros | ago-2026 | Data Cívica |
| Registros sin datos mínimos de identidad | 46,742 | registros | ago-2026 | Data Cívica |
| Registros históricos acumulados | 394,645 | reportes desde 1952 | mar-2026 | Diario de Morelos |
| Fosas documentadas 2006-2016 | 1,957 | fosas | 2016 | A dónde van los Desaparecidos |
| Fosas clandestinas documentadas (acumulado periodístico) | +4,500 | fosas | 2026 | López-Dóriga / PCDF |
| Cuerpos sin identificar en resguardo | +72,000 | cuerpos | 2026 | IBERO / PCDF |

Implicaciones:

- La serie del RNPDNO **no es reproducible**: cambia entre cortes y tiene registros confidencializados.
- Un modelo entrenado con lo visible aprende **dónde se busca y se reporta**, no necesariamente dónde ocurre.
- La victimización no denunciada es enorme; ENVIPE estima una cifra oculta superior al 90% para delitos en general.
- No se debe comparar un conteo de fosas con un conteo de personas.

## 5. Capas incluidas

### 5.1 Catálogo municipal

`src/main/resources/data/municipios.csv`

```
id,nombre,estado_id,lat,lon,poblacion,precision
01001,Aguascalientes,01,21.88333,-102.30000,723043,municipio
```

- `id`: clave INEGI de 5 dígitos.
- `precision`: `municipio` o `estado`. En 20 casos no hubo coordenada municipal en GeoNames y se usó el centroide estatal; el modelo lo trata como población baja y el mapa lo muestra igual.
- Población aproximada de GeoNames, no censo oficial. No usar para cálculos demográficos finos.

`estados.csv`: 32 entidades con centroide ponderado por población.

`estados.geo.json`: 32 polígonos estatales. Se enriquecen en tiempo de ejecución con `estadoId`, `registros`, `desaparecidas`, `localizadas` y `prioridad`.

### 5.2 Fosas por entidad y año

`src/main/resources/data/fosas_estados_2006_2016.csv`

```
estado_id,anio,fosas,cuerpos,cuerpos_identificados,restos_identificados
01,2007,1,2,2,0
```

- 145 filas con dato válido; los años sin dato (`-1` en la fuente) se excluyen, no se imputan como cero.
- Suma: 1,957 fosas.
- Sirve para el baseline estatal, el KDE y el backtest retrospectivo.
- Limitación: termina en 2016. No hay una serie abierta comparable 2017-2026.

### 5.3 Presencia documentada por municipio

`src/main/resources/data/presencia_municipal.csv`

```
municipio_id,presencia_documentada
01001,1
01002,1
```

- 2,469 filas; 788 positivos (31.9%).
- Derivado de la API pública de la Plataforma Ciudadana de Fosas, deduplicado por municipio.
- No contiene conteos ni fechas por municipio; es una etiqueta binaria.
- No debe interpretarse como “aquí hay una fosa” ni como “aquí no hay”.

### 5.4 Registros de búsqueda

La instalación combina la **base 2025** con los **hechos nuevos de abril de 2026**, ambos anonimizados:

- **137,583 personas únicas**: **133,887** de la base 2025 + **3,696** hechos nuevos de abril de 2026.
- **49,149 confidenciales** tras la deduplicación: estatus, sexo, fecha y/o municipio aparecen como confidenciales.
- **82,586** con municipio identificable.
- **54,997** sin municipio público.
- **0 localizadas**: la base contiene casos que siguen desaparecidos o no localizados.
- Sin nombres, sin fotos, sin causa.

El archivo está comprimido en `src/main/resources/data/registros_abril_2026.csv.gz` y se carga si no hay un `registros.csv` externo. El operador puede sustituirlo por un CSV autorizado con nombres; en ese caso la búsqueda por nombre se habilita.

La búsqueda por nombre usa `data/registros_nombres.csv` (Data Cívica, 78,684 registros), que sólo publica entidad. Se incluye en la imagen pública para habilitar el buscador y no se mezcla con los conteos municipales.

`DemoRecordsFactory` queda como respaldo de desarrollo si no hay ni base real ni archivo externo y `rastro.demo-enabled=true`.

## 6. Esquema de importación

`registros.csv` (UTF-8, encabezado obligatorio):

| Columna | Obligatoria | Tipo | Regla |
|---|---|---|---|
| `id` | No | texto | Único; si falta se genera |
| `folio` | No | texto | Referencia pública |
| `nombre` | Sí | texto | 3-120 caracteres normalizados |
| `edad` | No | entero | 0-120 |
| `sexo` | No | texto | Mujer/Hombre/No especificado |
| `fecha_visto` | Sí | fecha | ISO `yyyy-MM-dd` o `dd/MM/yyyy`; no futura |
| `municipio_id` | Sí | texto | Clave INEGI de 5 dígitos existente |
| `estatus` | Sí | texto | DESAPARECIDA, NO_LOCALIZADA, LOCALIZADA |
| `condicion` | No | texto | Sólo si está localizada |
| `fuente` | No | texto | Organización y convenio |
| `actualizado` | No | fecha | Corte del registro |

El importador también acepta `nombre_completo`, `nombres` + apellidos, `fecha_desaparicion`, `situacion`, `municipio` + `entidad` y coordenadas opcionales `latitud`/`longitud`. Ver [`DATOS_REALES.md`](DATOS_REALES.md).

Límites: 200,000 filas, 32 columnas, 8 KB por campo. Las filas inválidas se descartan; si no queda ninguna, la carga falla y se conserva la versión anterior.

`manifest.json`:

```json
{
  "version": "2026-11",
  "cutoff": "2026-10-31",
  "source": "Convenio de acceso a datos",
  "synthetic": false,
  "recordsFile": "registros.csv"
}
```

- `recordsFile` no puede contener `/`, `\` ni salir de `dataDir`.
- `synthetic` debe ser `true` si el archivo es de demostración.
- Si falta `version`, se usa el hash SHA-256 del CSV.

## 7. Actualización

El servicio revisa `mtime` de `registros.csv` y `manifest.json` cada 300 segundos (`rastro.refresh-seconds`). Si cambió:

1. valida y carga;
2. publica una instantánea nueva;
3. reconstruye índice y modelo en la siguiente petición;
4. conserva la versión anterior si la carga falla.

No hay endpoint de subida ni de recarga manual. Para forzar una recarga, reinicia el servicio o espera el ciclo.

## 8. Gobernanza recomendada

Antes de cargar datos reales:

- [ ] Base legal y convenio con la institución o organización titular.
- [ ] Evaluación de impacto en privacidad.
- [ ] Minimización: no cargar dirección, teléfono, documento, foto ni narrativa.
- [ ] Regla de acceso: quién puede ver la ficha completa y con qué fin.
- [ ] Protocolo para corrección y eliminación de registros.
- [ ] Aviso de privacidad y canal para familias.
- [ ] Revisión de licencia de cada capa (especialmente PCDF).
- [ ] Registro de versiones y cortes.
- [ ] Auditoría externa del modelo y de la comunicación de riesgo.

## 9. Qué no se ingiere

- Fichas personales de la SCJN o de registros estatales que no autorizan reutilización.
- El dominio `busquedas-dev.nayarit.gob.mx` (staging).
- La Búsqueda Generalizada mientras esté caída.
- Bases filtradas o de origen ilícito.
- Datos obtenidos evadiendo captchas o términos de uso.
- Microdatos de la Plataforma Ciudadana de Fosas sin autorización.

## 10. Atribución

- Límites: INEGI, Marco Geoestadístico.
- Coordenadas y población: GeoNames, CC BY 4.0.
- Fosas 2006-2016: A dónde van los Desaparecidos / Quinto Elemento Lab.
- Presencia municipal: Plataforma Ciudadana de Fosas (Artículo 19, Data Cívica, IBERO, PDH).
- Contexto y definiciones: RNPDNO / Comisión Nacional de Búsqueda.

Las cifras y links de contexto provienen de la auditoría [`investigacion/FUENTES_DATOS.md`](investigacion/FUENTES_DATOS.md) (consulta 2026-11-18).




