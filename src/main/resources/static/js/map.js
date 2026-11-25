import { el } from "./utils/dom.js";
import { number } from "./utils/format.js";

const L = window.L;

const MEXICO_BOUNDS = [
  [14.3, -118.6],
  [32.9, -86.3],
];

const COLORS = {
  ink: "#2b1d18",
  inkSoft: "#593e2e",
  clay: "#a64f3c",
  rust: "#a65729",
  umber: "#8c6954",
  rose: "#a67780",
  sand: "#f2cdac",
  none: "#e8dccd",
  paper: "#fbf6ee",
  line: "#d8c6b4",
};

function riskColor(priority) {
  if (priority >= 90) return COLORS.clay;
  if (priority >= 70) return COLORS.rust;
  if (priority > 0) return COLORS.rose;
  return COLORS.none;
}

function stateRiskColor(priority) {
  if (priority >= 90) return COLORS.rose;
  if (priority >= 70) return COLORS.sand;
  return COLORS.none;
}

function countColor(count, max) {
  if (!count) return COLORS.none;
  const ratio = max > 0 ? count / max : 0;
  if (ratio >= 0.55) return COLORS.inkSoft;
  if (ratio >= 0.28) return COLORS.clay;
  if (ratio >= 0.12) return COLORS.rust;
  if (ratio >= 0.04) return COLORS.umber;
  return COLORS.rose;
}

export class RastroMap {
  constructor(container, { onStateClick, onResultClick, onMunicipalityClick } = {}) {
    this.container = container;
    this.onStateClick = onStateClick || (() => {});
    this.onResultClick = onResultClick || (() => {});
    this.onMunicipalityClick = onMunicipalityClick || (() => {});
    this.layer = "registros";
    this.geo = null;
    this.risk = null;
    this.results = null;
    this.layerById = new Map();
    this.featuresById = new Map();
    this.markersByHit = new Map();
    this.selectedState = "";
    this.activeMarker = null;
    this.maxRecords = 1;
    this.cells = [];
    this.municipalities = [];
    this.streets = true;
    this.streetLayer = null;
    this.basemap = "estandar";
    this.ageRange = "Todos";
    this.maxAge = 1;
    this.singleResult = false;

    if (!L) {
      this.fallback();
      return;
    }

    this.map = L.map(container, {
      zoomControl: false,
      attributionControl: false,
      minZoom: 4,
      maxZoom: 19,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      maxBounds: MEXICO_BOUNDS,
      maxBoundsViscosity: 0.8,
      worldCopyJump: false,
      dragging: !window.matchMedia("(max-width: 1024px)").matches,
      touchZoom: !window.matchMedia("(max-width: 1024px)").matches,
    });
    this.map.setView([23.6345, -102.5528], 5);

    if (window.matchMedia("(max-width: 1024px)").matches) {
      const shell = container.closest(".map-shell") || container;
      const touchToggle = el("button", {
        class: "map-touch-toggle",
        type: "button",
        "aria-pressed": "false",
        text: "Mover mapa",
      });
      touchToggle.addEventListener("click", (event) => {
        event.stopPropagation();
        const active = this.map.dragging.enabled();
        if (active) {
          this.map.dragging.disable();
          this.map.touchZoom.disable();
          shell.classList.remove("is-map-active");
          touchToggle.textContent = "Mover mapa";
          touchToggle.setAttribute("aria-pressed", "false");
        } else {
          this.map.dragging.enable();
          this.map.touchZoom.enable();
          shell.classList.add("is-map-active");
          touchToggle.textContent = "Listo";
          touchToggle.setAttribute("aria-pressed", "true");
        }
      });
      container.append(touchToggle);
    }

    L.control.zoom({ position: "bottomright" }).addTo(this.map);
    L.control.scale({ position: "bottomleft", imperial: false, maxWidth: 110 }).addTo(this.map);
    this.attribution = L.control.attribution({ position: "bottomright", prefix: false }).addTo(this.map);
    this.applyBasemap("estandar");

    this.map.createPane("states");
    this.map.getPane("states").style.zIndex = "410";
    this.map.createPane("municipios");
    this.map.getPane("municipios").style.zIndex = "415";
    this.map.createPane("risk");
    this.map.getPane("risk").style.zIndex = "420";
    this.map.createPane("documented");
    this.map.getPane("documented").style.zIndex = "418";
    this.map.createPane("results");
    this.map.getPane("results").style.zIndex = "430";

    this.stateGroup = L.layerGroup().addTo(this.map);
    this.municipalityGroup = L.layerGroup().addTo(this.map);
    this.riskGroup = L.layerGroup().addTo(this.map);
    this.documentedGroup = L.layerGroup().addTo(this.map);
    this.resultGroup = L.layerGroup().addTo(this.map);

    this.drawGraticule();
    window.addEventListener("resize", () => this.map.invalidateSize({ debounceMoveend: true }));
  }

  fallback() {
    this.container.replaceChildren(
      el("div", { class: "map-fallback" },
        el("p", { class: "map-fallback__title", text: "El mapa no pudo cargarse" }),
        el("p", { class: "map-fallback__text", text: "La librería cartográfica no está disponible. Los resultados de búsqueda siguen funcionando en el panel." })
      )
    );
  }

  drawGraticule() {
    const style = {
      color: COLORS.inkSoft,
      weight: 0.5,
      opacity: 0.22,
      dashArray: "2 6",
      interactive: false,
    };
    for (let lat = 15; lat <= 35; lat += 5) {
      L.polyline([[-118.6, lat], [-86.3, lat]], style).addTo(this.map);
    }
    for (let lon = -115; lon <= -90; lon += 5) {
      L.polyline([[14.3, lon], [32.9, lon]], style).addTo(this.map);
    }
  }

  setGeo(geo) {
    if (!this.map || !geo) return;
    if (this.geo) {
      this.geo.remove();
      this.layerById.clear();
      this.featuresById.clear();
    }
    this.maxRecords = 1;
    this.maxAge = 1;
    for (const feature of geo.features || []) {
      const properties = feature.properties || {};
      this.maxRecords = Math.max(this.maxRecords, Number(properties.registros || 0));
      for (const value of Object.values(properties.gruposEdad || {})) {
        this.maxAge = Math.max(this.maxAge, Number(value || 0));
      }
    }
    this.geo = L.geoJSON(geo, {
      pane: "states",
      style: (feature) => this.stateStyle(feature.properties || {}),
      onEachFeature: (feature, layer) => {
        const properties = feature.properties || {};
        const id = properties.estadoId;
        if (id) {
          this.layerById.set(id, layer);
          this.featuresById.set(id, properties);
        }
        layer.bindTooltip(() => this.stateTooltip(properties), {
          className: "map-tooltip",
          direction: "top",
          sticky: true,
          opacity: 1,
        });
        layer.on({
          click: (event) => {
            if (event.originalEvent) {
              L.DomEvent.stopPropagation(event.originalEvent);
            }
            if (id) {
              if (id === this.selectedState) {
                this.onStateClick("", null);
              } else {
                this.onStateClick(id, properties);
              }
            }
          },
          mouseover: () => {
            if (id !== this.selectedState) {
              layer.setStyle({ weight: 1.4, color: COLORS.clay });
            }
          },
          mouseout: () => {
            if (id !== this.selectedState) {
              layer.setStyle(this.stateStyle(properties));
            }
          },
        });
      },
    }).addTo(this.map);

    this.map.invalidateSize({ animate: false });
    this.map.fitBounds(MEXICO_BOUNDS, { padding: [18, 18] });
    window.requestAnimationFrame(() => {
      this.map.invalidateSize({ animate: false });
      this.map.fitBounds(MEXICO_BOUNDS, { padding: [18, 18] });
    });
    window.setTimeout(() => {
      if (!this.map) return;
      this.map.invalidateSize({ animate: false });
      this.map.fitBounds(MEXICO_BOUNDS, { padding: [18, 18], animate: false });
    }, 320);
    this.applyLayer();
  }

  stateTooltip(properties) {
    const expected = Number(properties.fosasEsperadas || 0);
    const rate = Number(properties.tasaPor100k || 0).toFixed(2);
    const ageDetail = this.ageRange === "Todos"
      ? ""
      : ` · ${number((properties.gruposEdad || {})[this.ageRange] || 0)} de ${this.ageRange} años`;
    const detail = this.layer === "riesgo"
      ? `prioridad ${Math.round(Number(properties.prioridad || 0))} · ~${expected.toFixed(1)} fosas esperadas (modelo)`
      : `${number(properties.registros || 0)} registros · ${rate} por 100 mil${ageDetail}`;
    const node = el("div", {},
      el("span", { class: "map-tooltip__name", text: properties.name || "Entidad" }),
      el("span", { class: "map-tooltip__meta", text: detail })
    );
    return node;
  }

  stateStyle(properties) {
    const { fill, opacity } = this.stateFill(properties);
    const hidden = this.selectedState && properties.estadoId && properties.estadoId !== this.selectedState;
    return {
      color: hidden ? COLORS.line : COLORS.inkSoft,
      weight: this.selectedState === properties.estadoId ? 1.6 : 0.7,
      opacity: hidden ? 0.45 : 0.9,
      fillColor: hidden ? COLORS.none : fill,
      fillOpacity: hidden ? 0.04 : opacity,
    };
  }

  stateFill(properties) {
    if (this.layer === "riesgo") {
      return { fill: stateRiskColor(Number(properties.prioridad || 0)), opacity: 0.1 };
    }
    if (this.layer === "ambos") {
      return { fill: COLORS.none, opacity: 0.06 };
    }
    const ageCount = this.ageRange === "Todos" ? null
      : Number((properties.gruposEdad || {})[this.ageRange] || 0);
    if (ageCount != null) {
      return { fill: countColor(ageCount, this.maxAge), opacity: 0.18 };
    }
    return {
      fill: countColor(Number(properties.registros || 0), this.maxRecords),
      opacity: 0.08,
    };
  }

  applyBasemap(mode) {
    if (!this.map) return;
    this.basemap = mode === "relieve" ? "relieve" : "estandar";
    if (this.streetLayer) {
      this.streetLayer.remove();
    }
    this.streetLayer = this.basemap === "relieve"
      ? L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
          {
            maxZoom: 19,
            minZoom: 4,
            attribution: "Esri, HERE, Garmin, &copy; OpenStreetMap contributors",
            className: "map-tiles map-tiles--relief",
          }
        ).addTo(this.map)
      : L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          minZoom: 4,
          attribution: "&copy; OpenStreetMap contributors",
          className: "map-tiles map-tiles--osm",
        }).addTo(this.map);
    this.streets = true;
    if (this.geo) {
      this.geo.setStyle((feature) => this.stateStyle(feature.properties || {}));
    }
  }

  setBasemap(mode) {
    this.applyBasemap(mode);
    return this.basemap;
  }

  toggleStreets(enabled) {
    if (!this.map) return this.streets;
    this.streets = Boolean(enabled);
    if (this.streets && !this.streetLayer) {
      this.applyBasemap(this.basemap);
    } else if (!this.streets && this.streetLayer) {
      this.streetLayer.remove();
    }
    return this.streets;
  }

  setLayer(layer) {
    this.layer = layer;
    if (this.geo) {
      this.geo.setStyle((feature) => this.stateStyle(feature.properties || {}));
    }
    if (!this.map) return;
    this.applyLayer();
  }

  applyLayer() {
    if (!this.map) return;
    if (this.singleResult) {
      this.riskGroup.remove();
      this.documentedGroup.remove();
      this.municipalityGroup.remove();
      return;
    }
    if (this.layer === "riesgo" || this.layer === "ambos") {
      this.riskGroup.addTo(this.map);
      this.documentedGroup.addTo(this.map);
    } else {
      this.riskGroup.remove();
      this.documentedGroup.remove();
    }
    if (this.layer === "registros" || this.layer === "ambos") {
      this.municipalityGroup.addTo(this.map);
    } else {
      this.municipalityGroup.remove();
    }
  }

  setMunicipalities(items) {
    if (!this.map || !items) return;
    this.municipalities = items;
    this.renderMunicipalities();
  }

  setStateFilter(stateId) {
    this.selectedState = stateId || "";
    this.renderMunicipalities();
    this.renderPredictions();
    if (this.geo) {
      this.geo.setStyle((feature) => this.stateStyle(feature.properties || {}));
    }
  }

  setAgeRange(range) {
    this.ageRange = range || "Todos";
    this.renderMunicipalities();
    if (this.geo) {
      this.geo.setStyle((feature) => this.stateStyle(feature.properties || {}));
    }
  }

  renderMunicipalities() {
    if (!this.map) return;
    this.municipalityGroup.clearLayers();
    const items = this.municipalities.filter((item) =>
      !this.selectedState || item.estadoId === this.selectedState
    );
    const countOf = (item) => this.ageRange === "Todos"
      ? Number(item.registros || 0)
      : Number((item.gruposEdad || {})[this.ageRange] || 0);
    const max = Math.max(1, ...items.map(countOf));
    for (const item of items) {
      const count = countOf(item);
      if (count <= 0 || !Number.isFinite(item.lat) || !Number.isFinite(item.lon)) continue;
      const radius = 2.8 + Math.sqrt(count / max) * 12;
      const marker = L.circleMarker([item.lat, item.lon], {
        pane: "municipios",
        radius,
        color: COLORS.paper,
        weight: 1.2,
        fillColor: countColor(count, max),
        fillOpacity: 0.88,
        interactive: true,
      });
      marker.bindTooltip(() => el("div", {},
        el("span", { class: "map-tooltip__name", text: item.municipio }),
        el("span", {
          class: "map-tooltip__meta",
          text: `${number(count)}${this.ageRange === "Todos" ? " registros" : ` de ${this.ageRange}`} · ${Number(item.tasaPor100k || 0).toFixed(2)} por 100 mil`,
        })
      ), { className: "map-tooltip", direction: "top", opacity: 1 });
      marker.on("click", (event) => {
        if (event.originalEvent) {
          L.DomEvent.stopPropagation(event.originalEvent);
        }
        this.onMunicipalityClick(item);
      });
      marker.addTo(this.municipalityGroup);
    }
    this.applyLayer();
  }

  setPredictions(cells) {
    if (!this.map || !cells) return;
    this.cells = cells;
    this.renderPredictions();
  }

  renderPredictions() {
    if (!this.map) return;
    this.riskGroup.clearLayers();
    this.documentedGroup.clearLayers();
    const visible = this.selectedState
      ? this.cells.filter((cell) => cell.estadoId === this.selectedState)
      : this.cells;
    const top = [...visible]
      .filter((cell) => cell.prioridad >= 55)
      .sort((a, b) => b.prioridad - a.prioridad)
      .slice(0, 700);
    for (const cell of top) {
      const marker = L.circleMarker([cell.lat, cell.lon], {
        pane: "risk",
        radius: cell.prioridad >= 90 ? 4.2 : cell.prioridad >= 70 ? 3.6 : 2.9,
        stroke: false,
        fillColor: riskColor(cell.prioridad),
        fillOpacity: 0.78,
        interactive: true,
      });
      marker.bindTooltip(() => el("div", {},
        el("span", { class: "map-tooltip__name", text: cell.municipio }),
        el("span", {
          class: "map-tooltip__meta",
          text: `${cell.estado} · posible · prioridad ${Math.round(cell.prioridad)} · ~${Number(cell.fosasEsperadas || 0).toFixed(1)} esperadas`,
        })
      ), { className: "map-tooltip", direction: "top", opacity: 1 });
      marker.addTo(this.riskGroup);
    }

    
    for (const cell of visible.filter((item) => item.presenciaDocumentada === 1)) {
      const marker = L.circleMarker([cell.lat, cell.lon], {
        pane: "documented",
        radius: 5,
        color: COLORS.inkSoft,
        weight: 1.8,
        fill: false,
        fillOpacity: 0,
        interactive: true,
      });
      marker.bindTooltip(() => el("div", {},
        el("span", { class: "map-tooltip__name", text: cell.municipio }),
        el("span", {
          class: "map-tooltip__meta",
          text: `${cell.estado} · presencia documentada 2006-2024 · no es una coordenada de fosa`,
        })
      ), { className: "map-tooltip", direction: "top", opacity: 1 });
      marker.addTo(this.documentedGroup);
    }
    this.applyLayer();
  }

  showResult(hit) {
    if (!this.map) return;
    this.singleResult = true;
    this.municipalityGroup.remove();
    this.riskGroup.remove();
    this.documentedGroup.remove();
    this.resultGroup.clearLayers();
    this.markersByHit.clear();
    if (!hit || !Number.isFinite(hit.lat) || !Number.isFinite(hit.lon) || hit.lat === 0) return;
    const located = hit.estatus === "LOCALIZADA";
    const marker = L.circleMarker([hit.lat, hit.lon], {
      pane: "results",
      radius: 8,
      color: COLORS.paper,
      weight: 2,
      fillColor: located ? COLORS.inkSoft : COLORS.clay,
      fillOpacity: 1,
    });
    marker.bindTooltip(() => el("div", {},
      el("span", { class: "map-tooltip__name", text: hit.nombre }),
      el("span", {
        class: "map-tooltip__meta",
        text: `${hit.municipio}, ${hit.estado} · ${hit.estatusEtiqueta}`,
      })
    ), { className: "map-tooltip", direction: "top", opacity: 1 });
    marker.on("click", (event) => {
      if (event.originalEvent) {
        L.DomEvent.stopPropagation(event.originalEvent);
      }
      this.onResultClick(hit, marker);
    });
    marker.addTo(this.resultGroup);
    this.markersByHit.set(hit.id, marker);
  }

  showResults(hits) {
    if (!this.map) return;
    this.singleResult = false;
    this.applyLayer();
    this.resultGroup.clearLayers();
    this.markersByHit.clear();
    if (!hits || hits.length === 0) return;
    for (const hit of hits) {
      if (!Number.isFinite(hit.lat) || !Number.isFinite(hit.lon) || hit.lat === 0) continue;
      const located = hit.estatus === "LOCALIZADA";
      const marker = L.circleMarker([hit.lat, hit.lon], {
        pane: "results",
        radius: 6.5,
        color: COLORS.paper,
        weight: 1.6,
        fillColor: located ? COLORS.inkSoft : COLORS.clay,
        fillOpacity: 1,
      });
      marker.bindTooltip(() => el("div", {},
        el("span", { class: "map-tooltip__name", text: hit.nombre }),
        el("span", {
          class: "map-tooltip__meta",
          text: `${hit.municipio}, ${hit.estado} · ${hit.estatusEtiqueta}`,
        })
      ), { className: "map-tooltip", direction: "top", opacity: 1 });
      marker.on("click", (event) => {
        if (event.originalEvent) {
          L.DomEvent.stopPropagation(event.originalEvent);
        }
        this.onResultClick(hit, marker);
      });
      marker.addTo(this.resultGroup);
      this.markersByHit.set(hit.id, marker);
    }
    if (hits.length === 1) {
      const hit = hits[0];
      this.map.flyTo([hit.lat, hit.lon], 8, { duration: 0.9 });
    } else {
      const bounds = L.latLngBounds(hits.filter((hit) => hit.lat && hit.lon).map((hit) => [hit.lat, hit.lon]));
      if (bounds.isValid()) {
        this.map.flyToBounds(bounds, { padding: [60, 60], maxZoom: 8, duration: 0.9 });
      }
    }
  }

  focusResult(hit) {
    if (!this.map || !hit) return;
    if (!Number.isFinite(hit.lat) || !Number.isFinite(hit.lon) || hit.lat === 0) return;
    const marker = this.markersByHit.get(hit.id);
    if (this.activeMarker && this.activeMarker !== marker) {
      this.activeMarker.setStyle({ radius: 6.5, weight: 1.6 });
    }
    if (marker) {
      marker.setStyle({ radius: 9, weight: 2.2 });
      this.activeMarker = marker;
      marker.bringToFront();
    }
    this.map.flyTo([hit.lat, hit.lon], 8, { duration: 0.85 });
  }

  focusMunicipality(item) {
    if (!this.map || !item) return;
    const lat = Number(item.lat);
    const lon = Number(item.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    this.map.flyTo([lat, lon], 10, { duration: 0.85 });
  }

  highlightState(id) {
    if (!this.map) return;
    if (this.selectedState && this.layerById.has(this.selectedState)) {
      const previous = this.featuresById.get(this.selectedState);
      this.layerById.get(this.selectedState).setStyle(this.stateStyle(previous || {}));
    }
    this.selectedState = id || "";
    if (id && this.layerById.has(id)) {
      const layer = this.layerById.get(id);
      layer.setStyle({ color: COLORS.clay, weight: 2.1, opacity: 1 });
      layer.bringToFront();
      const bounds = layer.getBounds();
      if (bounds.isValid()) {
        this.map.flyToBounds(bounds, { padding: [30, 30], maxZoom: 7, duration: 0.8 });
      }
    }
  }

  clearSelection() {
    if (this.selectedState && this.layerById.has(this.selectedState)) {
      const previous = this.featuresById.get(this.selectedState);
      this.layerById.get(this.selectedState).setStyle(this.stateStyle(previous || {}));
    }
    this.selectedState = "";
    if (this.onStateClick) {
      this.onStateClick("", null);
    }
  }

  resetView() {
    if (!this.map) return;
    this.highlightState("");
    this.map.flyTo([23.6345, -102.5528], 5, { duration: 0.7 });
  }

  invalidate() {
    this.map?.invalidateSize({ debounceMoveend: true });
  }
}
