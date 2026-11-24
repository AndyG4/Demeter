                      
"""Evaluación exploratoria de M3 contra positivos documentados 2026.

No calcula precisión, Brier ni calibración: no hay negativos confirmados.
Sólo responde: ¿los municipios con hallazgo documentado quedan arriba?
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import random
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


def wilson(successes: int, total: int) -> tuple[float, float]:
    if total == 0:
        return 0.0, 0.0
    z = 1.96
    p = successes / total
    denominator = 1 + z * z / total
    center = (p + z * z / (2 * total)) / denominator
    margin = z * math.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / denominator
    return max(0.0, center - margin), min(1.0, center + margin)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--panel", required=True, type=Path)
    parser.add_argument("--scores", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()

    panel = [row for row in read_csv(args.panel) if row["label"] == "1"]
    scores = {row["municipioId"]: float(row["prioridad"]) for row in read_csv(args.scores)}
    municipalities = {row["id"]: row for row in read_csv(Path("src/main/resources/data/municipios.csv"))}

    matched = []
    missing = []
    for row in panel:
        key = row["municipio_id"]
        if key not in scores:
            missing.append(key)
            continue
        municipality = municipalities.get(key, {})
        matched.append({
            "municipio_id": key,
            "municipio": municipality.get("nombre", ""),
            "estado_id": row["estado_id"],
            "prioridad": scores[key],
            "banda": "A" if scores[key] >= 90 else "B" if scores[key] >= 70 else "C",
            "top_decile": scores[key] >= 90,
        })

    values = list(scores.values())
    positives = [item["prioridad"] for item in matched]
    top = sum(1 for item in matched if item["top_decile"])
    n = len(matched)
    low, high = wilson(top, n)
    mean_priority = sum(positives) / n if n else 0
    all_mean = sum(values) / len(values) if values else 0

                                                                             
                                                                     
    labels = [1 if key in {item["municipio_id"] for item in matched} else 0 for key in scores]
    ordered_scores = [scores[key] for key in scores]
    case_control_auc = auc(labels, ordered_scores)

                                                                            
                                                     
    by_state: dict[str, list[float]] = {}
    for municipality in municipalities.values():
        state = municipality["estado_id"]
        if municipality["id"] in scores:
            by_state.setdefault(state, []).append(scores[municipality["id"]])
    positive_states = [item["estado_id"] for item in matched]
    rng = random.Random(20261123)
    null = []
    for _ in range(5000):
        hits = 0
        for state in positive_states:
            pool = by_state.get(state, [])
            if pool and rng.choice(pool) >= 90:
                hits += 1
        null.append(hits)
    null_mean = sum(null) / len(null) if null else 0
    p_value = (sum(1 for value in null if value >= top) + 1) / (len(null) + 1)

    report = {
        "panel_positives": len(panel),
        "matched": n,
        "missing": missing,
        "top_decile_hits": top,
        "top_decile_rate": round(top / n, 4) if n else 0,
        "top_decile_rate_ci95": [round(low, 4), round(high, 4)],
        "random_top_decile_rate": 0.10,
        "enrichment_vs_random": round((top / n) / 0.10, 2) if n else 0,
        "mean_priority_positives": round(mean_priority, 2),
        "mean_priority_all": round(all_mean, 2),
        "band_counts": {
            "A": sum(1 for item in matched if item["banda"] == "A"),
            "B": sum(1 for item in matched if item["banda"] == "B"),
            "C": sum(1 for item in matched if item["banda"] == "C"),
        },
        "case_control_auc_descriptive": round(case_control_auc, 3),
        "state_matched_permutation_p": round(p_value, 4),
        "state_matched_null_top_decile_mean": round(null_mean, 2),
        "details": sorted(matched, key=lambda item: item["prioridad"], reverse=True),
        "warning": (
            "Sólo hay positivos documentados; no hay negativos confirmados. "
            "No se puede calcular precisión, Brier ni calibración, y no se debe entrenar con este panel. "
            "El AUC de caso-control trata a todos los demás municipios como no positivos, no como negativos verificados."
        ),
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
