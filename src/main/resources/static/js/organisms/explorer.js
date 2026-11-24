import { el, clear } from "../utils/dom.js";
import { icon } from "../atoms/icon.js";
import { statusPill, demoPill } from "../atoms/badge.js";
import { api, ApiError } from "../api.js";
import { date, number } from "../utils/format.js";
import { debounce } from "../utils/motion.js";
import { RastroMap } from "../map.js";
import { setState } from "../store.js";
import { createResultCard } from "../molecules/result-card.js";

const EXAMPLES = ["María Fernanda", "José Luis", "Hernández"];

function metricField(label, value) {
  return el("div", { class: "sheet__field" },
    el("dt", { text: label }),
    el("dd", { text: value ?? "Sin dato" })
  );
}

export function createExplorer() {
  const input = el("input", {
    class: "search-form__input",
    id: "search-input",
    name: "q",
    type: "search",
    placeholder: "Ej. María Fernanda Ruiz",
    maxlength: "80",
    autocomplete: "off",
    spellcheck: "false",
    "aria-describedby": "search-hint",
  });

  const submit = el("button", {
    class: "search-form__submit",
    type: "submit",
    "aria-label": "Buscar",
  }, icon("search", 20));

  const hint = el("p", { class: "search-form__hint", id: "search-hint" },
    "Acepta mayúsculas, acentos y errores de una letra. Mínimo 3 letras."
  );

  const examples = el("div", { class: "search-examples" },
    el("span", { class: "search-examples__label", text: "Probar" }),
    ...EXAMPLES.map((example) => el("button", {
      class: "search-example",
      type: "button",
      text: example,
      on: {
        click: () => {
          input.value = example;
          runSearch();
        },
      },
    }))
  );

  const form = el("form", { class: "search-form", id: "search-form", role: "search", on: { submit: (event) => { event.preventDefault(); runSearch(); } } },
    el("label", { class: "search-form__label", for: "search-input", text: "Nombre de la persona" }),
    el("div", { class: "search-form__row" }, input, submit),
    hint,
    examples
  );

  const stateSelect = el("select", {
    class: "field__control",
    id: "filter-estado",
    on: { change: () => onFilterChange() },
  },
    el("option", { value: "", text: "Todas" })
  );

  const statusSelect = el("select", {
    class: "field__control",
    id: "filter-estatus",
    on: { change: () => onFilterChange() },
  },
    el("option", { value: "", text: "Todas" }),
    el("option", { value: "desaparecida", text: "Desaparecida" }),
    el("option", { value: "no_localizada", text: "No localizada" }),
    el("option", { value: "localizada", text: "Localizada (sin datos)" })
  );

  const yearInput = el("input", {
    class: "field__control",
    id: "filter-anio",
    type: "number",
    inputmode: "numeric",
    min: "1900",
    max: "2100",
    placeholder: "Todos",
    on: { change: () => onFilterChange() },
  });

  const AGE_GROUPS = ["0-11", "12-17", "18-29", "30-44", "45-59", "60+", "Sin dato"];
  const ageSelect = el("select", {
    class: "field__control",
    id: "filter-edad",
    on: { change: () => onAgeChange() },
  },
    el("option", { value: "Todos", text: "Todas" }),
    ...AGE_GROUPS.map((group) => el("option", {
      value: group,
      text: group === "Sin dato" ? group : `${group} años`,
    }))
  );

  const ageProfile = el("div", { class: "age-profile", id: "age-profile", "aria-live": "polite" });

  const clearButton = el("button", {
    class: "clear-button",
    type: "button",
    text: "Limpiar",
    on: { click: () => resetAll() },
  });

  const panelCount = el("span", { class: "panel-tools__count", id: "panel-count", "aria-live": "polite" },
    "Escribe un nombre para empezar"
  );

  const sourceNote = el("p", { class: "source-note", id: "source-note" },
    "Modo demostración: registros sintéticos."
  );

  const resultsHeadTotal = el("span", { class: "results-head__title", id: "results-total", text: "—" });
  const results = el("div", { class: "results", id: "results" });

  const workspaceCount = el("span", { class: "workspace__count", id: "workspace-count" });

  const searchBlock = el("div", { class: "search-block" },
    form,
    el("div", { class: "filters" },
      el("label", { class: "field" },
        el("span", { class: "field__label", text: "Entidad" }),
        stateSelect
      ),
      el("label", { class: "field" },
        el("span", { class: "field__label", text: "Situación" }),
        statusSelect
      ),
      el("label", { class: "field field--wide" },
        el("span", { class: "field__label", text: "Año de la última vez" }),
        yearInput
      ),
      el("label", { class: "field field--wide" },
        el("span", { class: "field__label", text: "Rango de edad" }),
        ageSelect
      )
    ),
    el("div", { class: "panel-tools" }, panelCount, clearButton),
    sourceNote,
    ageProfile
  );

  const resultsBlock = el("div", { class: "results-block" },
    el("div", { class: "results-head" },
      el("span", { class: "results-head__title", text: "Coincidencias" }),
      resultsHeadTotal
    ),
    results
  );

  const searchColumn = el("div", { class: "search-column" }, searchBlock, resultsBlock);

  const mapNode = el("div", { class: "rastro-map", id: "map", role: "region", "aria-label": "Mapa de México" });

  const mapInfoButton = el("button", {
    class: "map-tool map-tool--info is-active",
    type: "button",
    "aria-expanded": "true",
    "aria-controls": "map-legend map-chrome",
    title: "Ocultar información del mapa",
    text: "Info",
    on: { click: () => setMapInfoVisible(mapShell.classList.contains("is-info-hidden")) },
  });

  const standardButton = el("button", {
    class: "map-tool is-active",
    type: "button",
    "data-basemap": "estandar",
    "aria-pressed": "true",
    text: "Estándar",
  });
  const reliefButton = el("button", {
    class: "map-tool",
    type: "button",
    "data-basemap": "relieve",
    "aria-pressed": "false",
    text: "Relieve",
  });
  const mapTools = el("div", { class: "map-tools" }, mapInfoButton, standardButton, reliefButton);

  const legend = el("div", { class: "map-legend", id: "map-legend" });

  const mapLoading = el("div", { class: "map-loading", id: "map-loading" },
    el("span", { class: "boot__mark", "aria-hidden": "true" }),
    el("p", { class: "map-loading__text", text: "Preparando geometría municipal" })
  );

  const mapShell = el("div", { class: "map-shell" },
    mapNode,
    mapTools,
    el("div", { class: "map-chrome", id: "map-chrome" },
      el("span", { class: "map-chrome__title", text: "México · 32 entidades" }),
      el("span", { class: "map-chrome__sub", id: "map-chrome-sub", text: "Personas · conteo agregado por municipio" })
    ),
    legend,
    el("p", { class: "map-caption" },
      "Límites: INEGI. Registros: ", el("a", { href: "https://versionpublicarnpdno.segob.gob.mx/", target: "_blank", rel: "noopener" }, "RNPDNO"),
      " (agregados). Fosas: ", el("a", { href: "https://data.adondevanlosdesaparecidos.org/", target: "_blank", rel: "noopener" }, "A dónde van los Desaparecidos"),
      " y ", el("a", { href: "https://plataformaciudadanadefosas.org/", target: "_blank", rel: "noopener" }, "PCDF"), "."
    ),
    mapLoading
  );

  function setMapInfoVisible(visible) {
    mapShell.classList.toggle("is-info-hidden", !visible);
    mapInfoButton.classList.toggle("is-active", visible);
    mapInfoButton.setAttribute("aria-expanded", String(visible));
    mapInfoButton.title = visible ? "Ocultar información del mapa" : "Mostrar información del mapa";
    mapInfoButton.textContent = visible ? "Info" : "Ver info";
  }

  
  setMapInfoVisible(!window.matchMedia("(max-width: 820px)").matches);

  const layerButtons = [
    ["registros", "Personas"],
    ["riesgo", "Posibles fosas"],
    ["ambos", "Ambos"],
  ].map(([value, label]) => el("button", {
    class: "segmented__button",
    type: "button",
    "data-layer": value,
    "aria-pressed": value === "registros" ? "true" : "false",
    text: label,
    on: { click: () => setLayer(value) },
  }));

  const layerSwitch = el("div", { class: "segmented", role: "group", "aria-label": "Capa del mapa" }, ...layerButtons);

  const bar = el("div", { class: "workspace__bar" },
    el("div", { class: "workspace__label" },
      el("strong", { text: "Explorador" }),
      el("span", { text: "·" }),
      el("span", { text: "Búsqueda por nombre y prioridad territorial" })
    ),
    layerSwitch,
    workspaceCount
  );

  const node = el("section", { class: "workspace", id: "mapa", "aria-labelledby": "mapa-title" },
    el("h2", { class: "visually-hidden", id: "mapa-title", text: "Explorador de registros y prioridad de búsqueda" }),
    bar,
    el("div", { class: "workspace__grid" },
      searchColumn,
      mapShell
    )
  );

  const backdrop = el("div", { class: "sheet-backdrop", hidden: true, on: { click: () => closeSheet() } });
  const sheet = el("aside", {
    class: "sheet",
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "sheet-title",
    hidden: true,
  });
  document.body.append(backdrop, sheet);

  let map = null;
  let geoData = null;
  let predictions = [];
  let municipalities = [];
  let municipalitiesByState = new Map();
  let cellsByState = new Map();
  let namesAvailable = true;
  let selectedMunicipality = null;
  let ageMode = "porcentaje";
  let hits = [];
  let total = 0;
  let lastSearch = null;
  let loadingMore = false;
  let activeCard = null;
  let activeHit = null;
  let controller = null;
  let currentLayer = "registros";
  let stateProps = new Map();
  let closeTimer = null;
  let lastFocus = null;

  map = new RastroMap(mapNode, {
    onStateClick: (id, properties) => onStateSelect(id, properties),
    onResultClick: (hit) => selectHit(hit, true),
    onMunicipalityClick: (item) => onMunicipalitySelect(item),
  });

  function chooseBasemap(mode) {
    map.setBasemap(mode);
    for (const button of [standardButton, reliefButton]) {
      const active = button.dataset.basemap === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    }
  }

  standardButton.addEventListener("click", () => chooseBasemap("estandar"));
  reliefButton.addEventListener("click", () => chooseBasemap("relieve"));

  const debouncedSearch = debounce(() => {
    if (input.value.trim().length >= 3) {
      runSearch();
    } else if (!input.value.trim()) {
      renderIdle();
    } else {
      renderHint();
    }
  }, 300);

  input.addEventListener("input", debouncedSearch);
  input.addEventListener("search", () => {
    if (!input.value.trim()) renderIdle();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && !isTyping(event.target)) {
      event.preventDefault();
      input.focus();
      input.select();
    }
    if (event.key === "Escape" && !sheet.hidden) {
      closeSheet();
    }
  });

  sheet.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const focusable = [...sheet.querySelectorAll("a[href], button:not([disabled]), input, select, textarea")];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  window.addEventListener("popstate", () => applyUrlState());

  function isTyping(target) {
    return target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
  }

  function setLayer(layer) {
    currentLayer = layer;
    setState({ layer });
    for (const button of layerButtons) {
      button.setAttribute("aria-pressed", String(button.dataset.layer === layer));
    }
    map.setLayer(layer);
    const sub = document.querySelector("#map-chrome-sub");
    if (sub) {
      sub.textContent =
        layer === "riesgo"
          ? "Posibles fosas · prioridad modelada A/B/C"
          : layer === "ambos"
            ? "Personas + posibles fosas (modelo)"
            : "Personas · conteo agregado por municipio";
    }
    renderLegend(layer);
  }

  function renderLegend(layer) {
    const title =
      layer === "riesgo"
        ? "Posibles fosas · prioridad"
        : layer === "ambos"
          ? "Personas y posibles fosas"
          : "Personas por municipio";
    const rows =
      layer === "riesgo"
        ? [
            ["documented", "Fosa documentada · presencia"],
            ["a", "Posible · prioridad A"],
            ["b", "Posible · prioridad B"],
            ["c", "Posible · prioridad C"],
            ["none", "Sin datos"],
          ]
        : layer === "ambos"
          ? [
              ["documented", "Fosa documentada"],
              ["a", "Posible · prioridad alta"],
              ["b", "Posible · prioridad media"],
              ["c", "Posible · prioridad baja"],
            ]
          : [
              ["c", "Menos registros"],
              ["b", "Registros medios"],
              ["a", "Más registros"],
            ];
    const foot =
      layer === "riesgo"
        ? "Anillo oscuro: presencia documentada por municipio. Punto relleno: posible fosa según el modelo. Ninguno es una coordenada exacta."
        : "Cada círculo resume los registros de un municipio; el tamaño crece con el conteo. No es una ubicación exacta.";
    clear(legend);
    legend.append(
      el("div", { class: "map-legend__head" },
        el("p", { class: "map-legend__title", text: title }),
        el("button", {
          class: "map-legend__close",
          type: "button",
          "aria-label": "Ocultar información del mapa",
          title: "Ocultar información",
          text: "×",
          on: { click: () => setMapInfoVisible(false) },
        })
      ),
      ...rows.map(([tone, label]) => el("div", { class: "map-legend__row" },
        el("span", { class: `map-legend__swatch map-legend__swatch--${tone}`, "aria-hidden": "true" }),
        el("span", { text: label })
      )),
      el("p", { class: "map-legend__foot", text: foot })
    );
  }

  function onFilterChange() {
    const estado = stateSelect.value;
    if (selectedMunicipality && selectedMunicipality.estadoId !== estado) {
      selectedMunicipality = null;
    }
    setState({ selectedState: estado });
    map.setStateFilter(estado || "");
    if (estado) {
      map.highlightState(estado);
    } else {
      map.highlightState("");
    }
    renderAgeProfile();
    if (input.value.trim().length >= 3) {
      runSearch();
    } else if (estado) {
      renderStateSummary(estado);
      updateUrl();
    } else {
      renderIdle();
    }
  }

  function onAgeChange() {
    map.setAgeRange(ageSelect.value);
    renderAgeProfile();
  }

  function renderAgeProfile() {
    if (!ageProfile) return;
    const groups = AGE_GROUPS;
    const estado = stateSelect.value;
    const selected = selectedMunicipality
      ? municipalities.find((item) => item.municipioId === selectedMunicipality.municipioId)
      : null;
    const contextName = selected
      ? `${selected.municipio}, ${selected.estado}`
      : estado
        ? (stateSelect.options[stateSelect.selectedIndex]?.text || "Entidad")
        : "México";
    const totals = Object.fromEntries(groups.map((group) => [group, 0]));
    if (selected) {
      for (const group of groups) {
        totals[group] += Number((selected.gruposEdad || {})[group] || 0);
      }
    } else {
      for (const item of municipalities) {
        if (estado && item.estadoId !== estado) continue;
        for (const group of groups) {
          totals[group] += Number((item.gruposEdad || {})[group] || 0);
        }
      }
    }
    const knownGroups = groups.filter((group) => group !== "Sin dato");
    const known = knownGroups.reduce((sum, group) => sum + totals[group], 0);
    const maxCount = Math.max(1, ...groups.map((group) => totals[group]));
    const maxPct = 100;
    const percent = (group) => (known > 0 ? (totals[group] / known) * 100 : 0);
    const leadGroup = ageSelect.value !== "Todos"
      ? ageSelect.value
      : [...knownGroups].sort((a, b) => percent(b) - percent(a))[0];
    const leadPct = percent(leadGroup);
    const formatPct = (value) => new Intl.NumberFormat("es-MX", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value);
    clear(ageProfile);
    ageProfile.append(
      el("div", { class: "age-profile__head" },
        el("div", { class: "age-profile__heading" },
          el("span", { class: "age-profile__title", text: "Perfil de edad" }),
          el("span", { class: "age-profile__context", text: contextName }),
          el("span", { class: "age-profile__total", text: known ? `${number(known)} con edad` : "Sin dato" })
        ),
        el("div", { class: "age-profile__toggle", role: "group", "aria-label": "Mostrar porcentaje o conteo" },
          el("button", {
            class: `age-profile__toggle-button${ageMode === "porcentaje" ? " is-active" : ""}`,
            type: "button",
            "aria-pressed": String(ageMode === "porcentaje"),
            text: "%",
            on: { click: () => { ageMode = "porcentaje"; renderAgeProfile(); } },
          }),
          el("button", {
            class: `age-profile__toggle-button${ageMode === "conteo" ? " is-active" : ""}`,
            type: "button",
            "aria-pressed": String(ageMode === "conteo"),
            text: "Conteo",
            on: { click: () => { ageMode = "conteo"; renderAgeProfile(); } },
          })
        )
      ),
      el("p", { class: "age-profile__lead", text: known > 0
        ? `En ${contextName}, ${formatPct(leadPct)}% de los registros con edad corresponde a ${leadGroup}.`
        : `Sin datos de edad para ${contextName}.` }),
      ...groups.map((group) => {
        const pct = percent(group);
        const active = ageSelect.value === group;
        const value = ageMode === "porcentaje" ? `${formatPct(pct)}%` : number(totals[group]);
        return el("button", {
          class: `age-profile__row${active ? " is-active" : ""}${group === "Sin dato" ? " is-muted" : ""}`,
          type: "button",
          "aria-pressed": String(active),
          on: {
            click: () => {
              ageSelect.value = active ? "Todos" : group;
              map.setAgeRange(ageSelect.value);
              renderAgeProfile();
            },
          },
        },
          el("span", { class: "age-profile__label", text: group }),
          el("progress", {
            class: "age-profile__bar",
            value: group === "Sin dato" ? 0 : (ageMode === "porcentaje" ? pct : totals[group]),
            max: ageMode === "porcentaje" ? maxPct : maxCount,
          }),
          el("span", { class: "age-profile__value", text: group === "Sin dato" && ageMode === "porcentaje" ? "—" : value })
        );
      }),
      el("p", { class: "age-profile__note", text: "Participación dentro de los registros con edad; no es una probabilidad individual ni está ajustada por población. Toca un rango para filtrar el mapa." })
    );
  }

  function onStateSelect(id, properties) {
    selectedMunicipality = null;
    if (!id) {
      stateSelect.value = "";
      setState({ selectedState: "" });
      map.setStateFilter("");
      updateUrl();
      if (input.value.trim().length >= 3) {
        runSearch();
      } else {
        renderIdle();
      }
      renderAgeProfile();
      return;
    }
    stateSelect.value = id;
    setState({ selectedState: id });
    map.setStateFilter(id);
    renderAgeProfile();
    updateUrl();
    if (input.value.trim().length >= 3) {
      runSearch();
    } else {
      renderStateSummary(id, properties);
    }
  }

  function onMunicipalitySelect(item) {
    if (!item) return;
    selectedMunicipality = municipalities.find((candidate) => candidate.municipioId === item.municipioId) || item;
    stateSelect.value = item.estadoId;
    setState({ selectedState: item.estadoId });
    map.setStateFilter(item.estadoId);
    map.highlightState(item.estadoId);
    map.focusMunicipality(item);
    renderMunicipalitySummary(item);
    renderAgeProfile();
    updateUrl();
  }

  async function renderMunicipalitySummary(item) {
    clear(results);
    const age = ageSelect.value;
    const ageCount = age === "Todos" ? Number(item.registros || 0) : Number((item.gruposEdad || {})[age] || 0);
    const rate = Number(item.poblacion) > 0 ? ageCount * 100_000 / Number(item.poblacion) : 0;
    const highRate = rate > 1_000;
    results.append(el("div", { class: "state-summary" },
      el("div", { class: "state-summary__head" },
        el("h3", { class: "state-summary__name", text: item.municipio }),
        el("span", { class: "eyebrow", text: item.estado })
      ),
      el("div", { class: "state-summary__stats" },
        el("div", { class: "state-summary__stat" },
          el("div", { class: "state-summary__value", text: number(ageCount) }),
          el("div", { class: "state-summary__label", text: age === "Todos" ? "Registros" : `Edad ${age}` })
        ),
        el("div", { class: "state-summary__stat" },
          el("div", { class: "state-summary__value", text: number(age === "Todos" ? item.desaparecidas + item.noLocalizadas : item.registros) }),
          el("div", { class: "state-summary__label", text: age === "Todos" ? "Sin localizar" : "Total municipio" })
        ),
        el("div", { class: "state-summary__stat" },
          el("div", { class: "state-summary__value", text: rate.toFixed(2) }),
          el("div", { class: "state-summary__label", text: age === "Todos" ? "Por 100 mil" : `Por 100 mil (${age})` })
        ),
        el("div", { class: "state-summary__stat" },
          el("div", { class: "state-summary__value", text: number(item.confidenciales) }),
          el("div", { class: "state-summary__label", text: "Confidenciales" })
        )
      ),
      el("p", { class: "empty__text", text: "El círculo es un agregado municipal; la ubicación es aproximada. Los registros de la base pública son anonimizados: no incluyen nombre. Los nombres públicos se buscan por nombre y sólo traen entidad." }),
      el("p", { class: "empty__text", text: `Tasa = ${number(ageCount)} registros${age === "Todos" ? "" : ` de ${age}`} ÷ ${number(item.poblacion)} habitantes × 100,000 = ${rate.toFixed(2)}. Es una tasa cruda de registros, no una probabilidad individual.${highRate ? " Una tasa superior a 1,000 por 100 mil es atípica y puede reflejar duplicados o concentración del reporte, no riesgo individual." : ""}` }),
      el("div", { class: "empty__rule" }),
      el("p", { class: "sheet__coords", text: "Centro aproximado del municipio; no es una ubicación exacta." })
    ));
    const list = el("div", { class: "anon-list" },
      el("p", { class: "source-note", text: "Cargando registros anonimizados…" })
    );
    results.append(list);
    panelCount.replaceChildren(el("strong", { text: item.municipio }), document.createTextNode(" seleccionado"));
    resultsHeadTotal.textContent = "Registros anonimizados";
    try {
      const records = await api.municipalityRecords(item.municipioId, 50, statusSelect.value);
      clear(list);
      if (!records.length) {
        const status = statusSelect.value;
        list.append(el("p", { class: "empty__text", text: status
          ? "No hay registros con ese estatus en este municipio. La fuente abierta no incluye personas localizadas."
          : "Este municipio no tiene registros individuales en la capa cargada." }));
        return;
      }
      list.append(el("p", { class: "anon-list__title", text: `Últimos ${records.length} registros del municipio` }));
      records.forEach((record, index) => {
        list.append(el("article", { class: "anon-card" },
          el("div", { class: "anon-card__top" },
            el("span", { class: "result-card__index", text: String(index + 1).padStart(2, "0") }),
            statusPill(record.estatus, record.estatusEtiqueta)
          ),
          el("p", { class: "anon-card__title", text: `Registro ${record.folio || record.id.slice(0, 8)}` }),
          el("div", { class: "anon-card__meta" },
            el("span", { text: record.sexo || "Sexo no público" }),
            el("span", { text: record.edad == null ? "Edad no pública" : `${record.edad} años` }),
            el("span", { text: date(record.fecha) })
          ),
          el("p", { class: "anon-card__source", text: record.origenReporte || record.fuente })
        ));
      });
      list.append(el("p", { class: "source-note", text: "Registros anonimizados del municipio. Los nombres públicos se buscan por nombre y sólo traen entidad." }));
    } catch (error) {
      clear(list);
      list.append(el("div", { class: "inline-error" },
        el("strong", { text: "Sin registros" }),
        error instanceof ApiError ? error.message : "No fue posible cargar los registros del municipio."
      ));
    }
  }

  async function runSearch() {
    if (!namesAvailable) {
      renderIdle();
      return;
    }
    const query = input.value.trim();
    if (query.length < 3) {
      renderHint();
      return;
    }
    if (controller) controller.abort();
    controller = new AbortController();
    renderLoading();
    const filters = {
      q: query,
      estado: stateSelect.value,
      estatus: statusSelect.value,
      anio: yearInput.value || "",
    };
    lastSearch = { filters, pageSize: 25 };
    try {
      const response = await api.search({
        ...filters,
        limit: 25,
        offset: 0,
      }, { signal: controller.signal });
      hits = response.resultados || [];
      total = response.total || 0;
      renderResults(response);
      map.showResults(hits);
      if (hits.length > 0) {
        window.requestAnimationFrame(() => {
          if (searchColumn.scrollHeight > searchColumn.clientHeight + 20) {
            searchColumn.scrollTop = Math.max(0, searchBlock.offsetHeight - 8);
          }
        });
      }
      updateUrl();
    } catch (error) {
      if (error.name === "AbortError") return;
      renderError(error);
    }
  }

  async function loadMore(all = false) {
    if (!lastSearch || loadingMore || hits.length >= total) return;
    loadingMore = true;
    const buttons = results.querySelectorAll(".load-more__button");
    buttons.forEach((button) => { button.disabled = true; });
    try {
      const target = all ? total : Math.min(total, hits.length + 50);
      while (hits.length < target) {
        const remaining = target - hits.length;
        const response = await api.search({
          ...lastSearch.filters,
          limit: Math.min(100, remaining),
          offset: hits.length,
        });
        const page = response.resultados || [];
        if (page.length === 0) break;
        hits = hits.concat(page);
        total = response.total || total;
        if (page.length < Math.min(100, remaining)) break;
      }
      renderResults({});
      map.showResults(hits);
    } catch (error) {
      renderError(error);
    } finally {
      loadingMore = false;
    }
  }

  function renderLoading() {
    clear(results);
    results.append(
      ...[0, 1, 2, 3].map(() => el("div", { class: "skeleton" },
        el("div", { class: "skeleton__line skeleton__line--short" }),
        el("div", { class: "skeleton__line skeleton__line--medium" }),
        el("div", { class: "skeleton__line" })
      ))
    );
    panelCount.textContent = "Buscando…";
    resultsHeadTotal.textContent = "—";
    workspaceCount.textContent = "";
  }

  function renderResults(response) {
    clear(results);
    if (hits.length === 0) {
      const status = statusSelect.value;
      const statusText = status === "localizada"
        ? "La capa pública de nombres no incluye personas localizadas; el mapa municipal muestra 0 registros con ese estatus."
        : status === "no_localizada"
          ? "La capa pública de nombres no incluye no localizadas; el mapa municipal sí tiene registros con ese estatus, pero sin nombre."
          : "Prueba con menos palabras, revisa la entidad o escribe el nombre sin acentos. También puedes buscar sólo un apellido.";
      results.append(el("div", { class: "empty" },
        el("h3", { class: "empty__title", text: "Sin coincidencias" }),
        el("p", { class: "empty__text", text: statusText }),
        el("div", { class: "empty__rule" }),
        el("p", { class: "empty__text", text: "Si la persona no aparece, acude a la Comisión Nacional de Búsqueda o a la fiscalía local. Este sitio no recibe denuncias." })
      ));
    } else {
      for (const [index, hit] of hits.entries()) {
        results.append(createResultCard(hit, index, (selected, card) => selectHit(selected, false, card)));
      }
    }
    if (hits.length > 0 && hits.length < total) {
      results.append(el("div", { class: "load-more" },
        el("p", { class: "load-more__text", text: `${number(hits.length)} de ${number(total)} coincidencias` }),
        el("div", { class: "load-more__actions" },
          el("button", {
            class: "load-more__button",
            type: "button",
            text: "Cargar 50 más",
            on: { click: () => loadMore(false) },
          }),
          el("button", {
            class: "load-more__button load-more__button--all",
            type: "button",
            text: `Ver todas (${number(total)})`,
            on: { click: () => loadMore(true) },
          })
        )
      ));
    }
    panelCount.replaceChildren(
      el("strong", { text: number(total) }),
      document.createTextNode(total === 1 ? " coincidencia" : " coincidencias")
    );
    resultsHeadTotal.textContent = hits.length === 0 ? "0" : `${hits.length} de ${number(total)}`;
    workspaceCount.replaceChildren(
      el("strong", { text: number(hits.length) }),
      document.createTextNode(" puntos en el mapa")
    );
    if (window.gsap && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.gsap.from(results.querySelectorAll(".result-card"), {
        opacity: 0,
        y: 8,
        duration: 0.32,
        stagger: 0.03,
        ease: "power2.out",
      });
    }
    updateUrl();
  }

  function selectHit(hit, fromMap = false, card = null) {
    activeHit = hit;
    if (activeCard) activeCard.classList.remove("is-active");
    const targetCard = card || results.querySelector(`[data-id="${CSS.escape(hit.id)}"]`);
    if (targetCard) {
      targetCard.classList.add("is-active");
      activeCard = targetCard;
    }
    map.showResult(hit);
    map.focusResult(hit);
    openSheet(hit);
  }

  function renderIdle() {
    hits = [];
    total = 0;
    clear(results);
    results.append(el("div", { class: "empty" },
      el("h3", { class: "empty__title", text: "El mapa empieza por lo agregado" }),
      el("p", { class: "empty__text", text: namesAvailable
        ? "Cada círculo resume las personas registradas en un municipio. Escribe un nombre para ubicar la última vez que se vio a una persona."
        : "Cada círculo resume los registros reales de un municipio. La base pública es anónima: no incluye nombres. Haz clic en un municipio para ver sus registros." }),
      el("div", { class: "empty__rule" }),
      el("p", { class: "empty__text", text: namesAvailable
        ? "La búsqueda por nombre es aproximada a la entidad: la fuente pública no publica municipio. El mapa municipal sigue siendo anónimo."
        : "La capa de nombres no está cargada; el mapa municipal sigue disponible." })
    ));
    panelCount.textContent = namesAvailable ? "Escribe un nombre para empezar" : "Consulta por municipio";
    resultsHeadTotal.textContent = "—";
    workspaceCount.textContent = "";
    map.showResults([]);
    updateUrl();
  }

  function renderHint() {
    hits = [];
    map.showResults([]);
    clear(results);
    results.append(el("div", { class: "empty" },
      el("h3", { class: "empty__title", text: "Faltan letras" }),
      el("p", { class: "empty__text", text: "Escribe al menos 3 letras del nombre o del apellido. Así evitamos listados demasiado amplios." })
    ));
    panelCount.textContent = "Mínimo 3 letras";
    resultsHeadTotal.textContent = "—";
  }

  function renderError(error) {
    hits = [];
    map.showResults([]);
    clear(results);
    const message = error instanceof ApiError ? error.message : "No fue posible conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.";
    results.append(el("div", { class: "inline-error" },
      el("strong", { text: "No se pudo buscar" }),
      message
    ));
    panelCount.textContent = "Error de consulta";
    resultsHeadTotal.textContent = "—";
    workspaceCount.textContent = "";
  }

  function renderStateSummary(id, providedProperties = null) {
    const properties = providedProperties || stateProps.get(id);
    if (!properties) return;
    const stateCells = cellsByState.get(id) || [];
    const age = ageSelect.value;
    const ageCount = (item) => age === "Todos" ? Number(item.registros || 0) : Number((item.gruposEdad || {})[age] || 0);
    const stateMunicipalities = (municipalitiesByState.get(id) || [])
      .filter((item) => ageCount(item) > 0)
      .sort((a, b) => ageCount(b) - ageCount(a))
      .slice(0, 5);
    const top = [...stateCells].sort((a, b) => b.prioridad - a.prioridad).slice(0, 5);
    const list = stateMunicipalities.length > 0
      ? stateMunicipalities.map((item) => el("div", { class: "state-summary__item" },
          el("span", { text: item.municipio }),
          el("b", { text: `${number(ageCount(item))} ${age === "Todos" ? "reg." : `de ${age}`}` })
        ))
      : top.map((cell) => el("div", { class: "state-summary__item" },
          el("span", { text: cell.municipio }),
          el("b", { text: `${Math.round(cell.prioridad)} · ${cell.banda}` })
        ));
    clear(results);
    const stateAgeCount = age === "Todos" ? Number(properties.registros || 0)
      : Number((properties.gruposEdad || {})[age] || 0);
    const statePopulation = Number(properties.poblacion || 0);
    const stateRate = statePopulation > 0 ? stateAgeCount * 100_000 / statePopulation
      : Number(properties.tasaPor100k || 0);
    results.append(el("div", { class: "state-summary" },
      el("div", { class: "state-summary__head" },
        el("h3", { class: "state-summary__name", text: properties.name }),
        el("span", { class: "eyebrow", text: `Clave ${id} · prioridad ${Math.round(Number(properties.prioridad || 0))}` })
      ),
      el("div", { class: "state-summary__stats" },
        el("div", { class: "state-summary__stat" },
          el("div", { class: "state-summary__value", text: number(stateAgeCount) }),
          el("div", { class: "state-summary__label", text: age === "Todos" ? "Registros" : `Edad ${age}` })
        ),
        el("div", { class: "state-summary__stat" },
          el("div", { class: "state-summary__value", text: number(properties.desaparecidas || 0) }),
          el("div", { class: "state-summary__label", text: "Sin localizar" })
        ),
        el("div", { class: "state-summary__stat" },
          el("div", { class: "state-summary__value", text: stateRate.toFixed(2) }),
          el("div", { class: "state-summary__label", text: age === "Todos" ? "Por 100 mil" : `Por 100 mil (${age})` })
        ),
        el("div", { class: "state-summary__stat" },
          el("div", { class: "state-summary__value", text: Number(properties.fosasEsperadas || 0).toFixed(1) }),
          el("div", { class: "state-summary__label", text: "Fosas esperadas" })
        )
      ),
      el("p", { class: "empty__text", text: stateMunicipalities.length > 0
        ? "Municipios con más registros en esta entidad:"
        : "Municipios con mayor prioridad histórica dentro de la entidad:" }),
      el("div", { class: "state-summary__list" }, ...list),
      el("div", { class: "empty__rule" }),
      el("p", { class: "empty__text", text: "Las fosas esperadas son una estimación del modelo, no fosas localizadas. La fuente abierta no reporta personas localizadas: no se calcula probabilidad de localización." })
    ));
    panelCount.replaceChildren(el("strong", { text: properties.name }), document.createTextNode(" seleccionada"));
    resultsHeadTotal.textContent = "Resumen";
  }

  function resetAll() {
    input.value = "";
    stateSelect.value = "";
    statusSelect.value = "";
    yearInput.value = "";
    ageSelect.value = "Todos";
    selectedMunicipality = null;
    setState({ selectedState: "" });
    map.setAgeRange("Todos");
    map.setStateFilter("");
    map.highlightState("");
    map.resetView();
    renderAgeProfile();
    renderIdle();
    updateUrl();
    input.focus();
  }

  function openSheet(hit) {
    lastFocus = document.activeElement;
    window.clearTimeout(closeTimer);
    const synthetic = hit.sintetico;
    const content = el("div", { class: "sheet__body" },
      el("div", { class: "sheet__status" },
        statusPill(hit.estatus, hit.estatusEtiqueta),
        synthetic ? demoPill("Registro sintético") : el("span", { class: "pill pill--demo", text: "Dato real" })
      ),
      hit.condicion ? el("p", { class: "sheet__condition", text: hit.condicion }) : null,
      el("dl", { class: "sheet__grid" },
        metricField("Edad", hit.edad == null ? "Sin dato" : `${hit.edad} años`),
        metricField("Sexo", hit.sexo),
        metricField("Última vez", date(hit.fechaVisto)),
        metricField("Coincidencia", hit.coincidencia),
        metricField("Precisión", hit.precisionUbicacion === "estado"
        ? "Aproximada a la entidad"
        : hit.precisionUbicacion === "sin_ubicacion" ? "Sin ubicación pública" : "Aproximada al municipio"),
        metricField("Folio interno", hit.folio || "Sin folio"),
        metricField("Fuente", hit.fuente)
      ),
      el("div", { class: "sheet__place" },
        el("p", { class: "eyebrow", text: "Último lugar conocido" }),
        el("p", { class: "sheet__place-name", text: hit.municipio }),
        el("p", { class: "sheet__place-meta", text: hit.municipio === hit.estado ? "México" : `${hit.estado} · México` }),
        el("p", { class: "sheet__coords", text: hit.precisionUbicacion === "sin_ubicacion"
          ? "Sin coordenada pública"
          : "Ubicación aproximada; no se muestra la coordenada exacta." })
      ),
      el("p", { class: "sheet__note", text: synthetic
        ? "Este registro es sintético y se usa sólo para demostrar el funcionamiento del buscador. No corresponde a una persona real."
        : "Los datos provienen de la fuente indicada. Verifica siempre la ficha oficial antes de tomar cualquier decisión." }),
      el("div", { class: "sheet__actions" },
        el("a", {
          class: "btn btn--ghost btn--block",
          href: "https://versionpublicarnpdno.segob.gob.mx/",
          target: "_blank",
          rel: "noopener",
        }, "Consultar el RNPDNO", icon("external", 14))
      )
    );

    sheet.replaceChildren(
      el("div", { class: "sheet__head" },
        el("div", {},
          el("p", { class: "sheet__kicker", text: "Ficha de registro" }),
          el("h3", { class: "sheet__name", id: "sheet-title", text: hit.nombre })
        ),
        el("button", {
          class: "sheet__close",
          type: "button",
          "aria-label": "Cerrar ficha",
          on: { click: () => closeSheet() },
        }, icon("close", 16))
      ),
      content
    );

    backdrop.hidden = false;
    sheet.hidden = false;
    requestAnimationFrame(() => {
      backdrop.classList.add("is-open");
      sheet.classList.add("is-open");
      sheet.querySelector(".sheet__close")?.focus();
    });
    document.body.classList.add("is-locked");
  }

  function closeSheet() {
    backdrop.classList.remove("is-open");
    sheet.classList.remove("is-open");
    document.body.classList.remove("is-locked");
    closeTimer = window.setTimeout(() => {
      backdrop.hidden = true;
      sheet.hidden = true;
    }, 240);
    if (lastFocus instanceof HTMLElement) {
      lastFocus.focus();
    }
  }

  function updateUrl() {
    const params = new URLSearchParams();
    if (input.value.trim()) params.set("q", input.value.trim());
    if (stateSelect.value) params.set("estado", stateSelect.value);
    if (statusSelect.value) params.set("estatus", statusSelect.value);
    if (yearInput.value) params.set("anio", yearInput.value);
    if (currentLayer !== "registros") params.set("capa", currentLayer);
    const query = params.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", url);
  }

  function applyUrlState() {
    const params = new URLSearchParams(window.location.search);
    input.value = params.get("q") || "";
    stateSelect.value = params.get("estado") || "";
    statusSelect.value = params.get("estatus") || "";
    yearInput.value = params.get("anio") || "";
    const layer = params.get("capa");
    if (["registros", "riesgo", "ambos"].includes(layer)) {
      setLayer(layer);
    }
    if (input.value.trim().length >= 3 && namesAvailable) {
      runSearch();
    } else if (stateSelect.value) {
      renderStateSummary(stateSelect.value);
    } else {
      renderIdle();
    }
  }

  function setGeo(geo) {
    geoData = geo;
    stateProps = new Map();
    const options = [el("option", { value: "", text: "Todas" })];
    const features = [...(geo?.features || [])].sort((a, b) =>
      String(a.properties?.name || "").localeCompare(String(b.properties?.name || ""), "es")
    );
    for (const feature of features) {
      const properties = feature.properties || {};
      if (!properties.estadoId) continue;
      stateProps.set(properties.estadoId, properties);
      options.push(el("option", { value: properties.estadoId, text: properties.name }));
    }
    clear(stateSelect);
    stateSelect.append(...options);
    const params = new URLSearchParams(window.location.search);
    if (params.get("estado")) {
      stateSelect.value = params.get("estado");
      setState({ selectedState: stateSelect.value });
    }
    map.setGeo(geo);
    map.setLayer(currentLayer);
    if (hits.length > 0) {
      map.showResults(hits);
    }
    if (mapLoading.isConnected) {
      mapLoading.remove();
    }
    renderLegend(currentLayer);
    if (stateSelect.value && input.value.trim().length < 3) {
      renderStateSummary(stateSelect.value);
    } else if (!input.value.trim()) {
      renderIdle();
    }
  }
  function setPredictions(response) {
    predictions = response?.resultados || [];
    cellsByState = new Map();
    for (const cell of predictions) {
      if (!cellsByState.has(cell.estadoId)) cellsByState.set(cell.estadoId, []);
      cellsByState.get(cell.estadoId).push(cell);
    }
    map.setPredictions(predictions);
  }

  function setMunicipalities(items) {
    municipalities = Array.isArray(items) ? items : [];
    if (selectedMunicipality) {
      selectedMunicipality = municipalities.find((item) => item.municipioId === selectedMunicipality.municipioId) || null;
    }
    municipalitiesByState = new Map();
    for (const item of municipalities) {
      if (!municipalitiesByState.has(item.estadoId)) municipalitiesByState.set(item.estadoId, []);
      municipalitiesByState.get(item.estadoId).push(item);
    }
    map.setMunicipalities(municipalities);
    renderAgeProfile();
    if (stateSelect.value && input.value.trim().length < 3) {
      renderStateSummary(stateSelect.value);
    }
  }

  function setStats(stats) {
    if (!stats) return;
    namesAvailable = stats.nombresDisponibles !== false;
    input.disabled = !namesAvailable;
    submit.disabled = !namesAvailable;
    examples.hidden = !namesAvailable;
    if (namesAvailable) {
      input.placeholder = "Ej. María Fernanda Ruiz";
      hint.textContent = "Búsqueda por nombre sobre la versión pública de Data Cívica: sólo publica entidad, no municipio. Mínimo 3 letras.";
    } else {
      input.placeholder = "La base pública anónima no incluye nombres";
      hint.textContent = "Haz clic en un municipio del mapa para ver sus registros reales. Para buscar por nombre, carga un CSV con nombres autorizado.";
    }
    if (stats.sintetico) {
      sourceNote.textContent = `Modo demostración: ${number(stats.registros)} registros sintéticos.`;
    } else if (namesAvailable) {
      sourceNote.textContent = `Mapa: ${number(stats.registros)} registros · ${number(stats.conMunicipio)} con municipio público en ${number(stats.municipiosConRegistros)} municipios · ${number(stats.confidenciales)} confidenciales · mapa hasta ${date(stats.ultimaFechaMapa)}. Búsqueda: nombres públicos de Data Cívica hasta ${date(stats.ultimaFechaNombres)} (sólo entidad).`;
    } else {
      sourceNote.textContent = `Datos reales anonimizados: ${number(stats.registros)} registros · ${number(stats.conMunicipio)} con municipio · ${number(stats.confidenciales)} confidenciales · mapa hasta ${date(stats.ultimaFechaMapa)}.`;
    }
    sourceNote.classList.toggle("is-real", !stats.sintetico);
    if (!namesAvailable) {
      renderIdle();
    }
  }

  function setLoadingError(message) {
    if (mapLoading.isConnected) {
      mapLoading.replaceChildren(
        el("p", { class: "map-fallback__title", text: "Sin geometría" }),
        el("p", { class: "map-fallback__text", text: message })
      );
    }
  }

  renderLegend(currentLayer);
  applyUrlState();

  return { node, setGeo, setPredictions, setMunicipalities, setStats, setLoadingError };
}
