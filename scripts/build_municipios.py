"""Construye el catálogo de municipios de México a partir de GeoNames (CC BY 4.0).

Entrada: _tmp/MX.txt, _tmp/admin1CodesASCII.txt, _tmp/admin2Codes.txt
Salida: src/main/resources/data/municipios.csv, estados.csv
"""
from __future__ import annotations

import csv
import math
import pathlib
import unicodedata

ROOT = pathlib.Path(__file__).resolve().parents[1]
TMP = ROOT / "_tmp"
OUT = ROOT / "src/main/resources/data"
OUT.mkdir(parents=True, exist_ok=True)

admin1: dict[str, str] = {}
for line in (TMP / "admin1CodesASCII.txt").read_text(encoding="utf-8").splitlines():
    parts = line.split("\t")
    if parts[0].startswith("MX."):
        admin1[parts[0].split(".")[1]] = parts[1]

admin2: dict[tuple[str, str], tuple[str, int]] = {}
for line in (TMP / "admin2Codes.txt").read_text(encoding="utf-8").splitlines():
    parts = line.split("\t")
    if not parts[0].startswith("MX."):
        continue
    _, a1, a2 = parts[0].split(".")
    admin2[(a1, a2)] = (parts[1], int(parts[3]))

records: dict[int, dict] = {}
places: dict[tuple[str, str], list[dict]] = {}
with (TMP / "MX.txt").open(encoding="utf-8", newline="") as fh:
    for row in csv.reader(fh, delimiter="\t"):
        if len(row) < 15:
            continue
        gid = int(row[0])
        a1, a2 = row[10], row[11]
        rec = {
            "id": gid,
            "name": row[1],
            "lat": float(row[4]),
            "lon": float(row[5]),
            "fclass": row[6],
            "fcode": row[7],
            "admin1": a1,
            "admin2": a2,
            "population": int(row[14] or 0),
        }
        records[gid] = rec
        if rec["fclass"] == "P" and a1 and a2:
            places.setdefault((a1, a2), []).append(rec)

municipios = []
for (a1, a2), (name, gid) in sorted(admin2.items(), key=lambda kv: (kv[0][0], kv[0][1])):
    seat = records.get(gid)
    pool = places.get((a1, a2), [])
    if seat and seat["lat"]:
        lat, lon = seat["lat"], seat["lon"]
    elif pool:
        lat = sum(p["lat"] for p in pool) / len(pool)
        lon = sum(p["lon"] for p in pool) / len(pool)
    else:
        continue
                                                                                      
    pop = seat["population"] if seat and seat["population"] > 0 else sum(p["population"] for p in pool)
    municipios.append(
        {
            "id": f"{int(a1):02d}{int(a2):03d}",
            "nombre": name,
            "estado_id": f"{int(a1):02d}",
            "lat": f"{lat:.5f}",
            "lon": f"{lon:.5f}",
            "poblacion": max(pop, 0),
        }
    )

                                                       
estados = {}
for m in municipios:
    e = estados.setdefault(m["estado_id"], {"peso": 0.0, "lat": 0.0, "lon": 0.0, "pob": 0, "n": 0})
    w = max(int(m["poblacion"]), 1)
    e["peso"] += w
    e["lat"] += float(m["lat"]) * w
    e["lon"] += float(m["lon"]) * w
    e["pob"] += int(m["poblacion"])
    e["n"] += 1

with (OUT / "municipios.csv").open("w", encoding="utf-8", newline="") as fh:
    w = csv.writer(fh)
    w.writerow(["id", "nombre", "estado_id", "lat", "lon", "poblacion"])
    for m in municipios:
        w.writerow([m["id"], m["nombre"], m["estado_id"], m["lat"], m["lon"], m["poblacion"]])

with (OUT / "estados.csv").open("w", encoding="utf-8", newline="") as fh:
    w = csv.writer(fh)
    w.writerow(["id", "nombre", "lat", "lon", "poblacion", "municipios"])
    for sid in sorted(estados, key=int):
        e = estados[sid]
        w.writerow(
            [
                sid,
                admin1.get(sid, sid),
                f"{e['lat'] / e['peso']:.5f}",
                f"{e['lon'] / e['peso']:.5f}",
                e["pob"],
                e["n"],
            ]
        )

print(f"municipios={len(municipios)} estados={len(estados)}")
print("población total aprox (GeoNames):", sum(e["pob"] for e in estados.values()))
