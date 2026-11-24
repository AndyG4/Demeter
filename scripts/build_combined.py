"""Combina la base 2025 (133,887) con los hechos nuevos de abril 2026.

No se suman las 192,212 filas completas de abril: sólo los hechos posteriores
al corte anterior (2025-10-02), para no duplicar el histórico y no reducir la
cifra base. Salida: registros_combinados.csv.gz.
"""
from __future__ import annotations

import csv
import gzip
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
OLD = ROOT / "src/main/resources/data/registros_reales.csv.gz"
NEW = ROOT / "src/main/resources/data/registros_abril_2026.csv.gz"
OUT = ROOT / "src/main/resources/data/registros_combinados.csv.gz"
CUTOFF = "2025-10-02"


def read(path):
    with gzip.open(path, "rt", encoding="utf-8", newline="") as fh:
        yield from csv.DictReader(fh)


def main() -> None:
    old = list(read(OLD))
    recent = [row for row in read(NEW) if row.get("fecha_visto") and row["fecha_visto"] >= CUTOFF]
    ids = {row["id"] for row in old}
    added = []
    for row in recent:
        if row["id"] in ids:
            continue
        ids.add(row["id"])
        added.append(row)
    with gzip.open(OUT, "wt", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(old[0].keys()))
        writer.writeheader()
        writer.writerows(old)
        writer.writerows(added)
    print(f"old={len(old)} recent={len(recent)} added={len(added)} total={len(old) + len(added)}")
    print(f"bytes={OUT.stat().st_size}")


if __name__ == "__main__":
    main()
