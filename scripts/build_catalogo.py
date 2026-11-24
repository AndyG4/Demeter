"""Cruza el catálogo municipal (ID INEGI + nombre) con GeoNames para obtener coordenadas.

Entradas:
  _tmp/df_mexico.csv      -> cve_ent, cve_mun, entidad, municipio (solo identificadores)
  _tmp/avd-states.json    -> fosas por estado y año (A dónde van los Desaparecidos)
  _tmp/pcdf-map-2.json    -> municipios con presencia documentada (Plataforma Ciudadana de Fosas)
  src/main/resources/data/municipios.csv (GeoNames, se reemplaza)
Salidas:
  src/main/resources/data/municipios.csv
  src/main/resources/data/estados.csv
  src/main/resources/data/fosas_estados_2006_2016.csv
  src/main/resources/data/presencia_municipal.csv
"""
from __future__ import annotations

import csv
import json
import pathlib
import unicodedata
from difflib import SequenceMatcher

ROOT = pathlib.Path(__file__).resolve().parents[1]
TMP = ROOT / "_tmp"
DATA = ROOT / "src/main/resources/data"

def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    s = s.lower().replace("ñ", "n")
    for ch in ".,;:-_()/":
        s = s.replace(ch, " ")
    return " ".join(s.split())

                                                                                             
avd_states = json.loads((TMP / "avd-states.json").read_text(encoding="utf-8"))
official_by_name = {norm(s["state_name"]): f"{int(s['state_code']):02d}" for s in avd_states}
official_names = {v: s["state_name"] for s in avd_states for v in [f"{int(s['state_code']):02d}"]}
                                                                    
ALIASES = {
    "Coahuila de Zaragoza": "Coahuila",
    "Michoacán de Ocampo": "Michoacán",
    "Veracruz de Ignacio de la Llave": "Veracruz",
    "Ciudad de México": "Mexico City",
}
for official, geoname in ALIASES.items():
    if norm(official) in official_by_name:
        official_by_name[norm(geoname)] = official_by_name[norm(official)]
state_centroids = {
    f"{int(s['state_code']):02d}": (float(s["centroid"]["coordinates"][1]), float(s["centroid"]["coordinates"][0]))
    for s in avd_states
    if s.get("centroid")
}

                                                                                       
base: dict[tuple[int, int], dict] = {}
with (TMP / "df_mexico.csv").open(encoding="utf-8", newline="") as fh:
    for row in csv.DictReader(fh):
        ent = int(row["cve_ent"])
        mun = int(row["cve_mun"].split("_")[1])
        base[(ent, mun)] = {
            "estado_id": ent,
            "nombre": row["municipio"].strip(),
            "estado": row["entidad"].strip(),
        }

                                                                        
geo: dict[tuple[int, str], list[dict]] = {}
state_names: dict[int, str] = {}
with (DATA / "municipios.csv").open(encoding="utf-8", newline="") as fh:
    for row in csv.DictReader(fh):
        key = (int(row["estado_id"]), norm(row["nombre"]))
        geo.setdefault(key, []).append(row)
with (DATA / "estados.csv").open(encoding="utf-8", newline="") as fh:
    for row in csv.DictReader(fh):
        state_names[int(row["id"])] = row["nombre"]

                                                                               
geo_oficial: dict[tuple[int, str], list[dict]] = {}
for (gid, name), rows in geo.items():
    gname = state_names.get(gid)
    oid = official_by_name.get(norm(gname))
    if not oid:
        continue
    geo_oficial.setdefault((int(oid), name), []).extend(rows)
geo = geo_oficial

                                                                       
municipios: list[dict] = []
unmatched: list[str] = []
for (ent, mun), item in sorted(base.items()):
    candidates = geo.get((ent, norm(item["nombre"])), [])
    chosen = None
    if candidates:
        chosen = max(candidates, key=lambda r: int(r["poblacion"]))
    else:
        pool = [r for (e, _), rows in geo.items() if e == ent for r in rows]
        best = max(pool, key=lambda r: SequenceMatcher(None, norm(r["nombre"]), norm(item["nombre"])).ratio(), default=None)
        if best and SequenceMatcher(None, norm(best["nombre"]), norm(item["nombre"])).ratio() >= 0.86:
            chosen = best
    if not chosen:
        lat, lon = state_centroids.get(f"{ent:02d}", (23.6, -102.5))
        municipios.append(
            {
                "id": f"{ent:02d}{mun:03d}",
                "nombre": item["nombre"],
                "estado_id": f"{ent:02d}",
                "estado": item["estado"],
                "lat": f"{lat:.5f}",
                "lon": f"{lon:.5f}",
                "poblacion": 0,
                "precision": "estado",
            }
        )
        unmatched.append(f"{official_names.get(f'{ent:02d}', ent)} / {item['nombre']}")
        continue
    municipios.append(
        {
            "id": f"{ent:02d}{mun:03d}",
            "nombre": item["nombre"],
            "estado_id": f"{ent:02d}",
            "estado": item["estado"],
            "lat": chosen["lat"],
            "lon": chosen["lon"],
            "poblacion": int(chosen["poblacion"] or 0),
            "precision": "municipio",
        }
    )

with (DATA / "municipios.csv").open("w", encoding="utf-8", newline="") as fh:
    w = csv.writer(fh)
    w.writerow(["id", "nombre", "estado_id", "lat", "lon", "poblacion", "precision"])
    for m in municipios:
        w.writerow([m["id"], m["nombre"], m["estado_id"], m["lat"], m["lon"], m["poblacion"], m["precision"]])

                                                     
estados: dict[str, dict] = {}
for m in municipios:
    e = estados.setdefault(m["estado_id"], {"nombre": m["estado"], "pob": 0, "w": 0.0, "lat": 0.0, "lon": 0.0, "n": 0})
    w = max(m["poblacion"], 1)
    e["pob"] += m["poblacion"]
    e["w"] += w
    e["lat"] += float(m["lat"]) * w
    e["lon"] += float(m["lon"]) * w
    e["n"] += 1

with (DATA / "estados.csv").open("w", encoding="utf-8", newline="") as fh:
    w = csv.writer(fh)
    w.writerow(["id", "nombre", "lat", "lon", "poblacion", "municipios"])
    for sid in sorted(estados):
        e = estados[sid]
        w.writerow([sid, e["nombre"], f"{e['lat'] / e['w']:.5f}", f"{e['lon'] / e['w']:.5f}", e["pob"], e["n"]])

                                                                       
states = json.loads((TMP / "avd-states.json").read_text(encoding="utf-8"))
code_by_name = {norm(e["nombre"]): sid for sid, e in estados.items()}
rows = []
for s in states:
    sid = code_by_name.get(norm(s["state_name"]))
    if not sid:
        continue
    for y in s.get("yearlyFosasData", []):
        if int(y.get("fosas", -1)) < 0:
            continue
        rows.append(
            {
                "estado_id": sid,
                "anio": int(y["year"]),
                "fosas": int(y["fosas"]),
                "cuerpos": int(y.get("cuerpos") or 0),
                "cuerpos_identificados": int(y.get("cuerpos_identificados") or 0),
                "restos_identificados": int(y.get("restos_identificados") or 0),
            }
        )
rows.sort(key=lambda r: (r["anio"], r["estado_id"]))
with (DATA / "fosas_estados_2006_2016.csv").open("w", encoding="utf-8", newline="") as fh:
    w = csv.DictWriter(fh, fieldnames=["estado_id", "anio", "fosas", "cuerpos", "cuerpos_identificados", "restos_identificados"])
    w.writeheader()
    w.writerows(rows)

                                                                                          
presence = json.loads((TMP / "pcdf-map-2.json").read_text(encoding="utf-8"))
ids = set()
for row in presence:
    ent, mun = int(row["id_ent"]), int(row["id_mun"])
    if mun > 0:
        ids.add(f"{ent:02d}{mun:03d}")
valid = {m["id"] for m in municipios}
present = sorted(i for i in ids if i in valid)
with (DATA / "presencia_municipal.csv").open("w", encoding="utf-8", newline="") as fh:
    w = csv.writer(fh)
    w.writerow(["municipio_id", "presencia_documentada"])
    for i in sorted(valid):
        w.writerow([i, 1 if i in present else 0])

print(f"municipios={len(municipios)} estados={len(estados)} fosas_estado_anio={len(rows)} presencia={len(present)}/{len(valid)}")
print("sin coordenadas:", len(unmatched))
for u in unmatched[:20]:
    print("  -", u)
