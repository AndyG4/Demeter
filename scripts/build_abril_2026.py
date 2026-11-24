"""Convierte la base anonimizada de abril 2026 de Data Cívica al esquema interno.

Entrada: C:\\Users\\elmic\\OneDrive\\Escritorio\\facturasUBER\\base_anonimizada_abril_2026.zip
La base no contiene nombres; conserva estado, municipio, sexo, edad, fechas y
estatus. Se usa para la capa municipal anónima, no para la búsqueda por nombre.

Salida: src/main/resources/data/registros_abril_2026.csv.gz
"""
from __future__ import annotations

import csv
import gzip
import pathlib
import re
import sys
import unicodedata
import zipfile

import pandas as pd

ROOT = pathlib.Path(__file__).resolve().parents[1]
ZIP = pathlib.Path(r"C:\Users\elmic\OneDrive\Escritorio\facturasUBER\base_anonimizada_abril_2026.zip")
OUT = ROOT / "src/main/resources/data/registros_abril_2026.csv.gz"
SOURCE = "RNPDNO · base filtrada abril 2026 (Data Cívica, anonimizada)"
CUTOFF = "2026-04-30"


def norm(value: str) -> str:
    value = unicodedata.normalize("NFKD", str(value or ""))
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", value).strip().upper()


STATE_ALIASES = {
    "ESTADO DE MEXICO": "MEXICO",
    "CIUDAD DE MEXICO": "CIUDAD DE MEXICO",
    "CDMX": "CIUDAD DE MEXICO",
    "MICHOACAN": "MICHOACAN",
    "VERACRUZ": "VERACRUZ DE IGNACIO DE LA LLAVE",
    "COAHUILA": "COAHUILA DE ZARAGOZA",
}


def main() -> None:
    if not ZIP.exists():
        print(f"No existe {ZIP}", file=sys.stderr)
        raise SystemExit(1)
    states = pd.read_csv(ROOT / "src/main/resources/data/estados.csv", dtype=str)
    municipalities = pd.read_csv(ROOT / "src/main/resources/data/municipios.csv", dtype=str)
    state_by_key = {norm(row.nombre): row.id for row in states.itertuples(index=False)}
    muni_by_state: dict[str, dict[str, str]] = {}
    for row in municipalities.itertuples(index=False):
        muni_by_state.setdefault(str(row.estado_id), {})[norm(row.nombre)] = row.id

    rows = []
    with zipfile.ZipFile(ZIP) as z:
        with z.open("base_anonimizada_abril_2026/base_anonimizada.csv") as fh:
            reader = csv.DictReader((line.decode("utf-8-sig") for line in fh))
            for index, row in enumerate(reader):
                raw_state = norm(row.get("estado"))
                state_key = STATE_ALIASES.get(raw_state, raw_state)
                state_id = state_by_key.get(state_key)
                muni_id = ""
                if state_id:
                    muni_id = muni_by_state.get(state_id, {}).get(norm(row.get("municipio")), "")
                status = norm(row.get("EstatusVictima")).replace(" / ", "/")
                if status in {"DESAPARECIDA/NO LOCALIZADA", "NO LOCALIZADA/DESAPARECIDA"}:
                    status = "NO_LOCALIZADA"
                if status not in {"DESAPARECIDA", "NO_LOCALIZADA", "LOCALIZADA", "CONFIDENCIAL"}:
                    status = "CONFIDENCIAL" if "CONFIDENCIAL" in status else "DESAPARECIDA"
                sex = {"HOMBRE": "Hombre", "MUJER": "Mujer", "INDETERMINADO": "No especificado"}.get(
                    norm(row.get("Sexo")), "Confidencial"
                )
                date = (row.get("fechahechos") or "")[:10]
                if not re.match(r"^\d{4}-\d{2}-\d{2}$", date):
                    date = (row.get("fechapercato") or "")[:10]
                if not re.match(r"^\d{4}-\d{2}-\d{2}$", date):
                    date = ""
                age_raw = (row.get("edad_actual_2026") or "").strip()
                age = age_raw if age_raw.isdigit() and 0 <= int(age_raw) <= 120 else ""
                record_id = (row.get("hash") or f"B{index:07d}").strip()
                rows.append(
                    {
                        "id": record_id,
                        "folio": "H-" + record_id[:8],
                        "nombre": "Persona anonimizada",
                        "edad": age,
                        "sexo": sex,
                        "fecha_visto": date,
                        "estado_id": state_id or "",
                        "municipio_id": muni_id,
                        "estatus": status,
                        "condicion": "",
                        "fuente": SOURCE,
                        "sintetico": "0",
                        "lat": "",
                        "lon": "",
                        "actualizado": CUTOFF,
                        "anonimizado": "1",
                        "origen_reporte": (row.get("dependenciaOrigen") or "").strip(),
                    }
                )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(OUT, "wt", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(f"filas={len(rows)} bytes={OUT.stat().st_size}")
    print("con municipio=", sum(1 for r in rows if r["municipio_id"]))
    print("con estado=", sum(1 for r in rows if r["estado_id"]))
    print("con fecha=", sum(1 for r in rows if r["fecha_visto"]))
    print("confidencial=", sum(1 for r in rows if r["estatus"] == "CONFIDENCIAL"))
    print("rango fechas=", min((r["fecha_visto"] for r in rows if r["fecha_visto"]), default=""),
          max((r["fecha_visto"] for r in rows if r["fecha_visto"]), default=""))


if __name__ == "__main__":
    main()
