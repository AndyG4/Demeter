                      
"""Ajuste de prevalencia (label shift) para calibrar probabilidades por estado.

No reordena: aplica una transformación monótona a las probabilidades para que
su prevalencia media se acerque a la prevalencia documentada del panel local.
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


def adjusted(p: float, source: float, target: float) -> float:
    source = min(0.999, max(0.001, source))
    target = min(0.999, max(0.001, target))
    odds = p / (1 - p) if p < 1 else 1e12
    factor = (target / (1 - target)) / (source / (1 - source))
    odds *= factor
    return odds / (1 + odds)


def brier(labels: list[int], scores: list[float]) -> float:
    return sum((score - label) ** 2 for label, score in zip(labels, scores)) / len(labels)


def ece(labels: list[int], scores: list[float]) -> float:
    bins = [[] for _ in range(10)]
    for label, score in zip(labels, scores):
        bins[min(9, max(0, int(score * 10)))].append((label, score))
    total = len(labels)
    error = 0.0
    for items in bins:
        if not items:
            continue
        observed = sum(label for label, _ in items) / len(items)
        predicted = sum(score for _, score in items) / len(items)
        error += len(items) / total * abs(observed - predicted)
    return error


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--panel", required=True, type=Path)
    parser.add_argument("--scores", required=True, type=Path)
    parser.add_argument("--source-prevalence", required=True, type=float)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()

    panel = read_csv(args.panel)
    scores = {
        (row.get("municipio_id") or row.get("municipioId") or ""): float(row["score"])
        for row in read_csv(args.scores)
    }
    labeled = [row for row in panel if row["label"] in {"0", "1"}]
    target = sum(int(row["label"]) for row in labeled) / len(labeled)
    adjusted_scores = {
        key: adjusted(value, args.source_prevalence, target)
        for key, value in scores.items()
    }

    labels = []
    values = []
    for row in labeled:
        key = row["municipio_id"]
        if key in adjusted_scores:
            labels.append(int(row["label"]))
            values.append(adjusted_scores[key])

    report = {
        "rows": len(values),
        "positives": sum(labels),
        "source_prevalence": args.source_prevalence,
        "target_documented_prevalence": round(target, 4),
        "brier": round(brier(labels, values), 4),
        "ece": round(ece(labels, values), 4),
        "warning": (
            "La prevalencia objetivo es la documentada en el registro local, "
            "no la prevalencia real de fosas no descubiertas. El ajuste corrige "
            "la escala, no convierte ceros documentales en ausencias verificadas."
        ),
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
