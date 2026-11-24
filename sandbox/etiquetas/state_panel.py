                      
"""Construye un panel estatal con cobertura documental completa.

No significa que todos los ceros sean ausencia real: significa que no hay
sitio documentado en el registro estatal al corte. Se usa sólo para evaluar
M3 contra un registro oficial, no para entrenar.
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
    parser.add_argument("--estado", required=True)
    parser.add_argument("--year", required=True, type=int)
    parser.add_argument("--positives", required=True, type=Path,
                        help="CSV con estado_id,municipio_id,event_date,label,status")
    parser.add_argument("--source", required=True)
    parser.add_argument("--source-url", required=True)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()

    catalog = read_csv(Path("src/main/resources/data/municipios.csv"))
    events = read_csv(args.positives)
    positives = {
        row["municipio_id"] for row in events
        if row["estado_id"] == args.estado
        and row.get("event_date", "").startswith(str(args.year))
        and row.get("label") == "1"
        and row.get("status") != "discarded"
    }

    rows = []
    for municipality in catalog:
        if municipality["estado_id"] != args.estado:
            continue
        is_positive = municipality["id"] in positives
        rows.append({
            "estado_id": args.estado,
            "municipio_id": municipality["id"],
            "year": str(args.year),
            "label": "1" if is_positive else "0",
            "coverage": "complete",
            "source": args.source,
            "source_url": args.source_url,
            "reason": "sitio documentado en el registro estatal" if is_positive
            else "sin sitio documentado en el registro estatal al corte",
        })

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()) if rows else [])
        writer.writeheader()
        writer.writerows(rows)

    report = {
        "estado": args.estado,
        "year": args.year,
        "municipalities": len(rows),
        "positives": sum(1 for row in rows if row["label"] == "1"),
        "documented_zeros": sum(1 for row in rows if row["label"] == "0"),
        "warning": (
            "Los ceros significan 'sin sitio documentado en el registro', "
            "no ausencia física verificada. El panel sirve para evaluar el "
            "ranking de presencia documentada, no para inferir fosas no descubiertas."
        ),
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
