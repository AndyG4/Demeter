                      
"""Construye un panel municipio-año de etiquetas de fosas, con procedencia.

Regla central:
- 1: al menos un evento positivo confirmado/probable.
- 0: no hay positivos y existe evidencia de ausencia con cobertura completa.
- -1: todo lo demás (desconocido).

Un evento sin URL, sin evidencia o sin fecha no se acepta.
Un 0 sin cobertura estatal completa se degrada a -1.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

REQUIRED = [
    "event_id", "estado_id", "municipio_id", "event_date", "label",
    "source_type", "source_url", "source_date", "definition", "evidence",
    "reviewer", "status", "coverage",
]
LABELS = {"1", "0", "-1"}
STATUSES = {"confirmed", "probable", "discarded"}
COVERAGE = {"complete", "partial", "none"}
SOURCE_TYPES = {"official", "ngo", "press", "registry"}


def read_rows(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        missing = [name for name in REQUIRED if name not in (reader.fieldnames or [])]
        if missing:
            raise SystemExit(f"Faltan columnas: {', '.join(missing)}")
        rows = []
        for line, row in enumerate(reader, start=2):
            clean = {key: (row.get(key) or "").strip() for key in REQUIRED}
            clean["_line"] = str(line)
            rows.append(clean)
        return rows


def valid_date(value: str) -> bool:
    try:
        date.fromisoformat(value)
        return True
    except ValueError:
        return False


def validate(rows: list[dict[str, str]]) -> list[str]:
    errors: list[str] = []
    seen: set[str] = set()
    for row in rows:
        line = row["_line"]
        if not row["event_id"]:
            errors.append(f"línea {line}: event_id vacío")
        elif row["event_id"] in seen:
            errors.append(f"línea {line}: event_id duplicado {row['event_id']}")
        seen.add(row["event_id"])
        if row["label"] not in LABELS:
            errors.append(f"línea {line}: label inválida")
        if row["status"] not in STATUSES:
            errors.append(f"línea {line}: status inválido")
        if row["coverage"] not in COVERAGE:
            errors.append(f"línea {line}: coverage inválido")
        if row["source_type"] not in SOURCE_TYPES:
            errors.append(f"línea {line}: source_type inválido")
        if not row["event_date"] or not valid_date(row["event_date"]):
            errors.append(f"línea {line}: event_date inválida")
        if not row["source_date"] or not valid_date(row["source_date"]):
            errors.append(f"línea {line}: source_date inválida")
        if not row["estado_id"].isdigit() or len(row["estado_id"]) != 2:
            errors.append(f"línea {line}: estado_id debe ser 2 dígitos")
        if not row["municipio_id"].isdigit() or len(row["municipio_id"]) != 5:
            errors.append(f"línea {line}: municipio_id debe ser 5 dígitos")
        parsed = urlparse(row["source_url"])
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            errors.append(f"línea {line}: source_url no es una URL http(s)")
        if not row["evidence"]:
            errors.append(f"línea {line}: evidence vacío")
        if not row["reviewer"]:
            errors.append(f"línea {line}: reviewer vacío")
        if row["label"] == "0" and row["coverage"] != "complete":
            errors.append(f"línea {line}: un 0 exige cobertura completa")
    return errors


def read_coverage(path: Path | None) -> dict[tuple[str, str], str]:
    if path is None:
        return {}
    coverage: dict[tuple[str, str], str] = {}
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            estado = (row.get("estado_id") or "").strip()
            year = (row.get("year") or "").strip()
            value = (row.get("coverage") or "").strip()
            if len(estado) != 2 or not year.isdigit() or value not in COVERAGE:
                continue
            coverage[(estado, year)] = value
    return coverage


def build(rows: list[dict[str, str]], coverage: dict[tuple[str, str], str]) -> tuple[list[dict], dict]:
    grouped: dict[tuple[str, str, str], dict] = defaultdict(lambda: {
        "positives": 0, "verified_negatives": 0, "unknowns": 0, "events": 0,
    })
    for row in rows:
        if row["status"] == "discarded":
            continue
        year = row["event_date"][:4]
        key = (row["estado_id"], row["municipio_id"], year)
        item = grouped[key]
        item["events"] += 1
        if row["label"] == "1":
            item["positives"] += 1
        elif row["label"] == "0":
            item["verified_negatives"] += 1
        else:
            item["unknowns"] += 1

    panel: list[dict] = []
    for (estado, municipio, year), item in sorted(grouped.items()):
        state_coverage = coverage.get((estado, year), "none")
        if item["positives"] > 0:
            label = "1"
            reason = "evento positivo"
        elif item["verified_negatives"] > 0 and state_coverage == "complete":
            label = "0"
            reason = "ausencia verificada con cobertura completa"
        else:
            label = "-1"
            reason = "sin positivos; ausencia no verificada"
        panel.append({
            "estado_id": estado,
            "municipio_id": municipio,
            "year": year,
            "label": label,
            "state_coverage": state_coverage,
            "positive_events": item["positives"],
            "verified_negative_events": item["verified_negatives"],
            "unknown_events": item["unknowns"],
            "events": item["events"],
            "reason": reason,
        })

    positives = sum(1 for row in panel if row["label"] == "1")
    negatives = sum(1 for row in panel if row["label"] == "0")
    unknowns = sum(1 for row in panel if row["label"] == "-1")
    complete_states = len({(row["estado_id"], row["year"]) for row in panel if row["state_coverage"] == "complete"})
    all_states = len({(row["estado_id"], row["year"]) for row in panel})
    summary = {
        "municipality_years": len(panel),
        "positives": positives,
        "confirmed_negatives": negatives,
        "unknowns": unknowns,
        "known_fraction": round((positives + negatives) / len(panel), 4) if panel else 0,
        "complete_state_years": complete_states,
        "state_years": all_states,
        "complete_state_fraction": round(complete_states / all_states, 4) if all_states else 0,
    }
    return panel, summary


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--coverage", type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--kind", choices=["real", "synthetic"], default="synthetic")
    args = parser.parse_args()

    rows = read_rows(args.input)
    errors = validate(rows)
    if errors:
        print(json.dumps({"ok": False, "errors": errors}, ensure_ascii=False, indent=2))
        return 1

    coverage = read_coverage(args.coverage)
    panel, summary = build(rows, coverage)
    args.out.mkdir(parents=True, exist_ok=True)
    panel_path = args.out / "panel_municipio_anio.csv"
    with panel_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(panel[0].keys()) if panel else [
            "estado_id", "municipio_id", "year", "label", "state_coverage",
            "positive_events", "verified_negative_events", "unknown_events",
            "events", "reason",
        ])
        writer.writeheader()
        writer.writerows(panel)

    gate_reasons = []
    if args.kind != "real":
        gate_reasons.append("dataset sintético: no sirve para entrenar ni validar el modelo")
    if summary["positives"] < 100:
        gate_reasons.append("menos de 100 positivos verificados")
    if summary["confirmed_negatives"] < 50:
        gate_reasons.append("menos de 50 negativos confirmados")
    if summary["known_fraction"] < 0.5:
        gate_reasons.append("menos de 50% de municipio-año con etiqueta conocida")
    if summary["complete_state_fraction"] < 0.7:
        gate_reasons.append("menos de 70% de entidad-año con cobertura completa")
    trainable = not gate_reasons
    report = {
        "ok": True,
        "kind": args.kind,
        "summary": summary,
        "trainable": trainable,
        "gate_reasons": gate_reasons,
        "panel": str(panel_path),
    }
    (args.out / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if trainable else 2


if __name__ == "__main__":
    sys.exit(main())
