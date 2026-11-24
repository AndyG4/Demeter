# Directorio de datos externos

Este directorio está vacío en el repositorio. El servicio lee, si existen:

- `registros.csv`
- `manifest.json`

Si no existen, carga la base real anonimizada incluida en el jar (`registros_reales.csv.gz`, 133,887 registros, CC0).

No commitees datos personales reales.

## manifest.json

```json
{
  "version": "2026-11",
  "cutoff": "2026-10-31",
  "source": "Convenio de acceso a datos",
  "synthetic": false,
  "recordsFile": "registros.csv"
}
```

## registros.csv

```csv
id,folio,nombre,edad,sexo,fecha_visto,municipio_id,estatus,condicion,fuente,actualizado
R-0001,EXP-2026-001,María Fernanda Ruiz Salas,34,Mujer,2026-10-12,01001,DESAPARECIDA,,Convenio,2026-11-01
```

Reglas:

- `municipio_id` debe ser una clave INEGI de 5 dígitos del catálogo. También se acepta `municipio` + `estado` y el importador resuelve la clave.
- `estatus`: `DESAPARECIDA`, `NO_LOCALIZADA` o `LOCALIZADA`.
- `fecha_visto`: `yyyy-MM-dd` o `dd/MM/yyyy`; no futura. También se acepta `fecha_desaparicion`.
- `nombre`: 3-120 caracteres normalizados. También se aceptan `nombres` + `apellido_paterno` + `apellido_materno`.
- Coordenadas opcionales `latitud`/`longitud`; si faltan, el punto se aproxima al municipio.
- Máximo 200,000 filas.
- `synthetic` debe ser `true` si el archivo es de demostración.

El servicio también busca versiones autorizadas de `fosas_estados_2006_2016.csv` y `presencia_municipal.csv`; si cambian, reentrena el modelo.

Esquema completo, controles y texto de solicitud: [`../docs/DATOS_REALES.md`](../docs/DATOS_REALES.md).
