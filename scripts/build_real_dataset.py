"""Convierte el dataset abierto CC0 de personas desaparecidas de Datamx.io
al esquema interno de Rastro.

Fuente: https://datamx.io/dataset/personas-desaparecidas-y-no-localizadas-en-mexico
Licencia: CC0. No contiene nombres; los registros son anonimizados.
Salida: src/main/resources/data/registros_reales.csv.gz
"""
from __future__ import annotations

import csv
import gzip
import io
import pathlib
import urllib.request

import pandas as pd

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "src/main/resources/data/registros_reales.csv.gz"
CATALOG = ROOT / "src/main/resources/data/municipios.csv"
URL = "https://datamx.io/dataset/816b51f3-7e04-4834-9b58-d51e02cb4783/resource/e2e8fd8b-dc10-440a-a015-473f3616c83a/download/data.csv"

SOURCE = "RNPDNO · datos abiertos anonimizados (Codeando México / Data Cívica)"
CUTOFF = "2025-10-02"


def download() -> pd.DataFrame:
    cache = ROOT / "_tmpdata/datamx.csv"
    if not cache.exists():
        cache.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(URL, timeout=120) as response:
            cache.write_bytes(response.read())
    return pd.read_csv(cache, dtype=str, keep_default_na=False)


def clean(value: str) -> str:
    value = (value or "").strip()
    return "" if value.upper() in {"CONFIDENCIAL", "CONFIDENCIAL ", "N/A", "NULL"} else value


def parse_date(value: str):
    date = clean(value)
    if not date:
        return ""
    parsed = pd.to_datetime(date, errors="coerce")
    return "" if pd.isna(parsed) else parsed.strftime("%Y-%m-%d")


def main() -> None:
    df = download()
    catalog = set(pd.read_csv(CATALOG, dtype=str)["id"])
    rows = []
    for row in df.itertuples(index=False):
        ent = str(int(row.CVE_ENT)).zfill(2) if str(row.CVE_ENT).strip().isdigit() else ""
        mun_code = str(int(row.CVE_MUN)).zfill(3) if str(row.CVE_MUN).strip().isdigit() else ""
        mun_id = f"{ent}{mun_code}" if ent and mun_code and mun_code != "999" else ""
        if mun_id and mun_id not in catalog:
            mun_id = ""
        if not ent:
            continue
        fecha = parse_date(row.FECHA_DESAPARICION) or parse_date(row.FECHA_REGISTRO)
        status = clean(row.ESTATUS_VICTIMA).upper().replace(" ", "_")
        if status not in {"DESAPARECIDA", "NO_LOCALIZADA"}:
            status = "CONFIDENCIAL"
        sexo = {
            "HOMBRE": "Hombre",
            "MUJER": "Mujer",
            "INDETERMINADO": "No especificado",
        }.get(clean(row.SEXO).upper(), "Confidencial")
        edad = ""
        birth = parse_date(row.FECHA_NACIMIENTO)
        if birth and fecha:
            try:
                years = (pd.Timestamp(fecha) - pd.Timestamp(birth)).days // 365
                if 0 <= years <= 120:
                    edad = str(years)
            except Exception:
                pass
        rows.append(
            {
                "id": row.ID_VICTIMA.strip(),
                "folio": "ID-" + row.ID_VICTIMA.strip()[:8],
                "nombre": "Persona anonimizada",
                "edad": edad,
                "sexo": sexo,
                "fecha_visto": fecha,
                "estado_id": ent,
                "municipio_id": mun_id,
                "estatus": status,
                "condicion": "",
                "fuente": SOURCE,
                "sintetico": "0",
                "lat": "",
                "lon": "",
                "actualizado": CUTOFF,
                "anonimizado": "1",
                "origen_reporte": clean(row.ORIGEN_REPORTE),
            }
        )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(OUT, "wt", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(f"filas={len(rows)} gz_bytes={OUT.stat().st_size}")
    print("con municipio=", sum(1 for r in rows if r["municipio_id"]))
    print("confidencial=", sum(1 for r in rows if r["estatus"] == "CONFIDENCIAL"))


if __name__ == "__main__":
    main()
