"""Convierte la versión pública de nombres de Data Cívica a un CSV de búsqueda.

Fuente: https://volveradesaparecer.datacivica.org/datos-abiertos
Archivo: Versión Pública del RNPDNO (11 variables), publicado por la CNB y
reconstruido por Data Cívica. **No incluye municipio**, sólo entidad.

El archivo se guarda en `data/registros_nombres.csv` y NO se empaqueta en el jar.
La búsqueda devuelve nombre, edad, sexo, fecha y entidad; la ubicación es
aproximada al centroide estatal.
"""
from __future__ import annotations

import csv
import pathlib
import urllib.request

import pandas as pd

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "data/registros_nombres.csv"
URL = "https://drive.usercontent.google.com/download?id=13GK5Vt9WjB_G4vkCpymmMH1QwkQobJGa&export=download"


def download() -> pathlib.Path:
    cache = ROOT / "_tmpdata/nombres.csv"
    if not cache.exists():
        cache.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(URL, timeout=120) as response:
            cache.write_bytes(response.read())
    return cache


def main() -> None:
    df = pd.read_csv(download(), dtype=str, keep_default_na=False, encoding="latin-1")
    rows = []
    seen = set()
    for index, row in df.iterrows():
        sex = (row.get("Sexo") or "").strip().upper()
        if sex.startswith("ELIMINADO"):
            continue
        name = " ".join(
            part.strip()
            for part in (row.get("Nombre"), row.get("Primer Apellido"), row.get("Segundo Apellido"))
            if part and part.strip()
        ).strip()
        if len(name) < 3:
            continue
        date = (row.get("Fecha de desaparición") or "").strip()
        parsed = pd.to_datetime(date, dayfirst=True, errors="coerce")
        estado = (row.get("Entidad de desaparición") or "").strip()
        if not estado or estado.upper() in {"EXTRANJERO", "SE DESCONOCE"}:
            continue
        base_id = f"N{row.get('Consecutivo Reportes por Persona', index)}-{row.get('Consecutivo Registro', index)}"
        record_id = base_id
        suffix = 1
        while record_id in seen:
            suffix += 1
            record_id = f"{base_id}-{suffix}"
        seen.add(record_id)
        rows.append(
            {
                "id": record_id,
                "folio": record_id[:24],
                "nombre": name,
                "edad": (row.get("Edad") or "").strip(),
                "sexo": {"HOMBRE": "Hombre", "MUJER": "Mujer"}.get(sex, "No especificado"),
                "fecha_visto": "" if pd.isna(parsed) else parsed.strftime("%Y-%m-%d"),
                "estado": estado,
                "municipio_id": "",
                "estatus": "DESAPARECIDA",
                "condicion": "",
                "fuente": "Data Cívica / RNPDNO · nombres públicos",
                "sintetico": "0",
                "anonimizado": "0",
                "origen_reporte": (row.get("Autoridad que reportó") or "").strip(),
                "actualizado": "2024-03-19",
            }
        )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(f"filas={len(rows)} bytes={OUT.stat().st_size}")


if __name__ == "__main__":
    main()
