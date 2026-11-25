# Cómo cargar datos reales

## 0. Lo que ya está cargado

La instalación combina la **base 2025** con los **hechos nuevos de abril de 2026** publicados anonimizados por Data Cívica: **137,583 personas únicas** (133,887 de 2025 + 3,696 nuevos) y corte 2026-04-30. No tienen nombre; sí tienen sexo, edad, fecha, estatus, entidad y municipio cuando la fuente los publica. El mapa, los conteos y las fichas anónimas ya usan esos datos.

La **búsqueda por nombre** usa `data/registros_nombres.csv`, la versión pública de nombres de Data Cívica. Son **78,684 registros** con nombre, edad, sexo, fecha y entidad; **no incluyen municipio**. El buscador muestra `Aproximada a la entidad`. El archivo se incluye en la imagen pública y se puede retirar.

Para **nombre + municipio** se necesita un archivo autorizado. Este documento explica cómo cargarlo.

## 1. Lo que no es posible

El RNPDNO **no tiene descarga masiva, API pública ni exportación CSV**. La versión estadística permite consulta individual por nombre o folio; no entrega el padrón completo. Que un registro no esté confidencializado **no significa que sea reutilizable en bloque**: sigue siendo dato personal sensible y su tratamiento requiere base legal.

Por eso Demeter **no descarga, scrapea ni evade captchas** del portal oficial. Hacerlo incumpliría los términos de uso y la normativa de protección de datos personales. Tampoco se usan bases filtradas **sin anonimizar**; la base usada es la versión anonimizada que publica Data Cívica.

## 2. Vías legítimas

| Vía | Qué se obtiene | Uso |
|---|---|---|
| Solicitud de transparencia a la CNB / SESNSP | Registros autorizados, con campos y corte definidos | Carga local en `./data` |
| Convenio con CNB, fiscalías o comisiones estatales | CSV/API institucional con responsable del tratamiento | Producción |
| Base autorizada de una organización aliada | Registros con consentimiento o base legal | Investigación |
| Consulta individual en el portal oficial | Ficha por persona | Atención a familias, no para poblar el mapa |

Demeter puede firmar la capa técnica, pero **la autorización la da la institución**. No hay forma legítima de convertir la consulta individual en un padrón masivo sin esa autorización.

## 3. Nombres públicos (sólo entidad)

`data/registros_nombres.csv` se genera con:

```bash
python scripts/build_names_dataset.py
```

Columnas: `id,folio,nombre,edad,sexo,fecha_visto,estado,municipio_id,estatus,fuente,origen_reporte,actualizado`. `municipio_id` va vacío porque la fuente no lo publica. El cargador lo detecta al iniciar y lo usa sólo para el buscador; no se mezcla con los conteos municipales.

Para **nombre + municipio** hay que aportar un CSV autorizado; no existe una fuente abierta que una ambos campos.

## 4. Esquema aceptado

El importador acepta encabezados propios y oficiales habituales. Ejemplo:

```csv
folio,nombres,apellido_paterno,apellido_materno,fecha_desaparicion,municipio,entidad,situacion,latitud,longitud,fuente
EXP-2026-001,María Fernanda,Ruiz,Salas,2025-11-13,San Luis Potosí,San Luis Potosí,Desaparecida,22.1500,-100.9800,Convenio CNB
```

También funciona el esquema propio:

```csv
id,folio,nombre,edad,sexo,fecha_visto,municipio_id,estatus,condicion,fuente,actualizado
R-0001,EXP-2026-001,María Fernanda Ruiz Salas,34,Mujer,2025-11-13,24028,DESAPARECIDA,,Convenio,2026-11-01
```

### Columnas reconocidas

| Campo interno | Encabezados aceptados |
|---|---|
| Nombre | `nombre`, `nombres`, `nombre_completo`, `nombre_s` + `apellido_paterno`, `apellido_materno` |
| Fecha | `fecha_visto`, `fecha_desaparicion`, `fecha_de_desaparicion`, `fecha_hechos`, `fecha` |
| Municipio | `municipio_id`, `cve_mun`, `clave_municipio`, `id_municipio`; o `municipio`/`nom_mun` + `estado`/`entidad` |
| Estatus | `estatus`, `situacion`, `estado_situacion` |
| Condición | `condicion`, `condicion_localizacion` |
| Coordenadas | `latitud`/`lat`, `longitud`/`lon`/`lng` (opcionales) |
| Folio | `folio`, `expediente`, `numero_expediente` |
| Fuente | `fuente`, `source` |

### Resolución de municipios

- Si hay clave INEGI, se usa.
- Si no, se busca por nombre y entidad. Si el nombre existe en varias entidades, se elige el de mayor población.
- Si no se puede resolver, la fila se descarta.
- Si no hay coordenadas, el punto se dispersa de forma determinista alrededor del centroide municipal. La ficha muestra `Precisión: Aproximada al municipio`.
- Si hay coordenadas válidas dentro de México, se validan, pero la API pública no las devuelve: el punto se aproxima al municipio y la ficha muestra `Precisión: Aproximada al municipio`.

## 5. Manifest

Crea `data/manifest.json`:

```json
{
  "version": "2026-11-convenio",
  "cutoff": "2026-10-31",
  "source": "Convenio CNB / SESNSP",
  "synthetic": false,
  "recordsFile": "registros.csv"
}
```

- Si `synthetic` es `false`, la interfaz muestra **Datos autorizados** y la fuente.
- Si `synthetic` es `true`, se marca como demostración.
- Si el manifest declara datos reales y el archivo no existe, el servicio **no arranca**; no cae silenciosamente a demo.

## 6. Carga

1. Copia `registros.csv` y `manifest.json` a `rastro/data/`.
2. Reinicia el servicio o espera el ciclo de recarga (5 minutos).
3. Verifica:

```bash
curl -s http://localhost:8080/api/v1/stats
curl -s http://localhost:8080/api/v1/geo/municipios | jq '.[0]'
curl -s "http://localhost:8080/api/v1/search?q=Mar%C3%ADa&limit=1" | jq
```

4. Revisa que `sintetico` sea `false`, que `registros` coincida con el archivo y que los municipios resueltos no estén vacíos.

### Actualizar la capa de fosas

También puedes colocar en `data/` versiones autorizadas de:

- `fosas_estados_2006_2016.csv` (`estado_id,anio,fosas,cuerpos,cuerpos_identificados,restos_identificados`).
- `presencia_municipal.csv` (`municipio_id,presencia_documentada`).

El servicio los detecta por `mtime`, cambia la versión del conjunto y **reentrena el modelo**. No se recargan desde una URL: siguen siendo archivos locales autorizados.

## 7. Controles que debes aplicar

- [ ] Base legal documentada (convenio, consentimiento, transparencia).
- [ ] Evaluación de impacto en privacidad.
- [ ] Minimización: no cargar dirección, teléfono, documento, fotos ni datos de familiares.
- [ ] `dataDir` con permisos restringidos, fuera del webroot.
- [ ] Aviso de privacidad y canal de corrección/eliminación.
- [ ] Revisión de que el archivo no contenga datos de menores innecesarios.
- [ ] Registro de versión, corte y responsable.
- [ ] Auditoría antes de abrir la instancia al público.

## 8. Lo que Demeter no hará con datos reales

- No mostrará listados masivos ni permitirá descargar el padrón.
- No inferirá autoría, motivación ni pertenencia a grupos criminales.
- No usará los nombres para publicidad, perfilamiento ni venta.
- No cruzará los datos con otras bases sin base legal.
- No presentará la prioridad municipal como una fosa localizada.

## 9. Texto base para una solicitud

> Solicito acceso a la base de datos de personas desaparecidas y no localizadas, con corte [fecha], en formato CSV, con las siguientes variables: nombre completo, edad, sexo, fecha de desaparición, entidad, municipio, estatus y condición de localización. La finalidad es [búsqueda/observatorio], con medidas de seguridad [cifrado, acceso restringido, minimización] y sin transferencia a terceros. Solicito que, cuando proceda, la información se entregue en versión pública o pseudonimizada.

La solicitud debe presentarse por la Plataforma Nacional de Transparencia o por el convenio institucional que corresponda. Demeter no puede sustituir ese trámite.






