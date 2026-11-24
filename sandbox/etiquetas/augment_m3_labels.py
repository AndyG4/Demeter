                      
"""Propone una actualización de etiquetas de M3 con positivos oficiales 2025-2026.

Nunca elimina positivos. Sólo puede convertir un 0 en 1 si una fuente oficial
documenta el municipio. No convierte un 0 en negativo.
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return [{key: (value or "").strip() for key, value in row.items()}
                for row in csv.DictReader(handle)]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True, type=Path)
    parser.add_argument("--official", nargs="+", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    args = parser.parse_args()

    base = read_csv(args.base)
    labels = {row["municipio_id"]: int(row["presencia_documentada"]) for row in base}
    official: dict[str, str] = {}
    for path in args.official:
        for row in read_csv(path):
            if row.get("label") == "1" and row.get("year") in {"2025", "2026"}:
                official[row["municipio_id"]] = str(path)

    additions = {key: source for key, source in official.items() if labels.get(key, 0) == 0}
    base_positives = sum(1 for value in labels.values() if value == 1)
    for key in additions:
        labels[key] = 1

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["municipio_id", "presencia_documentada"])
        writer.writeheader()
        for key, value in sorted(labels.items()):
            writer.writerow({"municipio_id": key, "presencia_documentada": value})

    report = {
        "base_positives": base_positives,
        "final_positives": sum(1 for value in labels.values() if value == 1),
        "official_municipalities_2025_2026": len(official),
        "new_positives": len(additions),
        "additions": additions,
        "action": "No se reentrenó M3: hay que evaluar el cambio contra un panel temporal congelado.",
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
