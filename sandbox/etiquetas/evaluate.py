                      
"""Evalúa scores contra etiquetas 1/0 verificadas, sin reentrenar.

No usa etiquetas -1: no hay manera honesta de saber si un municipio sin
registro es negativo. Tampoco convierte un 0 no verificado en negativo.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
from pathlib import Path


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return [{key: (value or "").strip() for key, value in row.items()}
                for row in csv.DictReader(handle)]


def auc(labels: list[int], scores: list[float]) -> float:
    positives = sum(labels)
    negatives = len(labels) - positives
    if positives == 0 or negatives == 0:
        return 0.5
    order = sorted(range(len(scores)), key=lambda i: scores[i])
    ranks = [0.0] * len(scores)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and scores[order[j + 1]] == scores[order[i]]:
            j += 1
        rank = (i + 1 + j + 1) / 2
        for k in range(i, j + 1):
            ranks[order[k]] = rank
        i = j + 1
    rank_sum = sum(ranks[i] for i in range(len(labels)) if labels[i] == 1)
    return (rank_sum - positives * (positives + 1) / 2) / (positives * negatives)


def average_precision(labels: list[int], scores: list[float]) -> float:
    order = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
    positives = sum(labels)
    if positives == 0:
        return 0.0
    hits = 0
    total = 0.0
    for i, index in enumerate(order):
        if labels[index] == 1:
            hits += 1
            total += hits / (i + 1)
    return total / positives


def precision_at(labels: list[int], scores: list[float], fraction: float) -> float:
    order = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
    k = max(1, math.ceil(len(order) * fraction))
    return sum(labels[index] for index in order[:k]) / k


def recall_at(labels: list[int], scores: list[float], fraction: float) -> float:
    order = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
    k = max(1, math.ceil(len(order) * fraction))
    positives = sum(labels)
    return sum(labels[index] for index in order[:k]) / positives if positives else 0.0


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
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--kind", choices=["real", "synthetic"], default="synthetic")
    args = parser.parse_args()

    panel = read_csv(args.panel)
    score_rows = read_csv(args.scores)
    scores: dict[tuple[str, str], float] = {}
    scores_by_id: dict[str, float] = {}
    for row in score_rows:
        municipality = row.get("municipio_id") or row.get("municipioId") or ""
        if not municipality:
            continue
        value = float(row.get("score") or row.get("prioridad") or 0)
        scores_by_id[municipality] = value
        if row.get("year"):
            scores[(municipality, row["year"])] = value
    labels: list[int] = []
    values: list[float] = []
    skipped_unknown = 0
    skipped_missing_score = 0
    for row in panel:
        if row["label"] not in {"0", "1"}:
            skipped_unknown += 1
            continue
        key = (row["municipio_id"], row["year"])
        if key in scores:
            score = scores[key]
        elif row["municipio_id"] in scores_by_id:
            score = scores_by_id[row["municipio_id"]]
        else:
            skipped_missing_score += 1
            continue
        labels.append(int(row["label"]))
        values.append(score)

    if len(labels) < 20 or len(set(labels)) < 2:
        print(json.dumps({
            "ok": False,
            "reason": "Se necesitan al menos 20 municipio-año con etiqueta 0/1 y ambas clases.",
            "labeled": len(labels),
            "positives": sum(labels),
            "skipped_unknown": skipped_unknown,
            "skipped_missing_score": skipped_missing_score,
        }, ensure_ascii=False, indent=2))
        return 2

    report = {
        "ok": True,
        "kind": args.kind,
        "labeled": len(labels),
        "positives": sum(labels),
        "prevalence": sum(labels) / len(labels),
        "skipped_unknown": skipped_unknown,
        "skipped_missing_score": skipped_missing_score,
        "ap": average_precision(labels, values),
        "auc": auc(labels, values),
        "precision10": precision_at(labels, values, 0.10),
        "recall10": recall_at(labels, values, 0.10),
        "brier": brier(labels, values),
        "ece": ece(labels, values),
        "warning": (
            "Dataset sintético: las métricas sólo prueban que el pipeline funciona, "
            "no que el modelo prediga fosas."
            if args.kind != "real" else
            "Evaluación temporal: no usar estas etiquetas para entrenar el mismo modelo."
        ),
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
