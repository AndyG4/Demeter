import { el, clear } from "../utils/dom.js";
import { icon } from "../atoms/icon.js";
import { number, percent } from "../utils/format.js";

const FEATURE_LABELS = {
  log_poblacion: "Población municipal (log)",
  latitud: "Latitud",
  longitud: "Longitud",
  fosas_entidad_log: "Fosas históricas de la entidad",
  tasa_fosas_100k: "Tasa de fosas por 100 mil",
  distancia_centro_entidad_km: "Distancia al centro de la entidad",
  distancia_frontera_km: "Distancia a la frontera norte",
  municipios_entidad_log: "Número de municipios de la entidad",
  poblacion_entidad_log: "Población de la entidad",
};

function metric(label, value) {
  return el("div", { class: "model-card__small" },
    el("dt", { text: label }),
    el("dd", { text: value })
  );
}

function modelCard(model, selected) {
  const ap = Number(model.ap || 0);
  return el("article", { class: `model-card ${selected ? "is-selected" : ""}` },
    selected ? el("span", { class: "selected-flag", text: "Publicado" }) : null,
    el("div", { class: "model-card__top" },
      el("span", { class: "model-card__id", text: model.id.toUpperCase() }),
      el("span", { class: "eyebrow", text: model.seleccionado ? "Seleccionado" : "Contraste" })
    ),
    el("h3", { class: "model-card__name", text: model.nombre }),
    el("p", { class: "model-card__desc", text: model.descripcion }),
    el("div", { class: "model-card__metric" },
      el("span", { class: "model-card__metric-value", text: ap.toFixed(3) }),
      el("span", { class: "model-card__metric-label", text: "AP · average precision" })
    ),
    el("dl", { class: "model-card__metrics" },
      metric("AUC", Number(model.auc || 0).toFixed(3)),
      metric("Precisión @10%", percent(model.precision10, 1)),
      metric("Lift @10%", `${Number(model.lift10 || 0).toFixed(2)}×`),
      metric("Brier", model.brier == null ? "—" : Number(model.brier).toFixed(3))
    )
  );
}

function importancePanel(importance) {
  const entries = Object.entries(importance || {}).sort((a, b) => b[1] - a[1]);
  const max = entries.length ? Math.max(...entries.map(([, value]) => value)) : 1;
  const rows = entries.map(([key, value]) => {
    const fill = el("span", { class: "importance__fill" });
    fill.style.setProperty("--value", String(max > 0 ? value / max : 0));
    return el("div", { class: "importance__row" },
      el("span", { class: "importance__label", text: FEATURE_LABELS[key] || key }),
      el("span", { class: "importance__track" }, fill),
      el("span", { class: "importance__value", text: `${(value * 100).toFixed(1)}%` })
    );
  });
  return el("div", { class: "panel-box" },
    el("p", { class: "panel-box__title" },
      el("span", { text: "Importancia de variables" }),
      el("span", { text: "RF" })
    ),
    el("div", { class: "importance" }, ...rows)
  );
}

function foldsPanel(folds) {
  return el("div", { class: "panel-box" },
    el("p", { class: "panel-box__title" },
      el("span", { text: "Validación espacial · 8 folds" }),
      el("span", { text: "dejar entidades fuera" })
    ),
    el("div", { class: "table-wrap" },
      el("table", { class: "data-table" },
        el("thead", {},
          el("tr", {},
            el("th", { text: "Fold" }),
            el("th", { text: "Municipios" }),
            el("th", { text: "Positivos" }),
            el("th", { text: "AUC" }),
            el("th", { text: "AP" }),
            el("th", { text: "P@10%" }),
            el("th", { text: "Lift" })
          )
        ),
        el("tbody", {},
          ...(folds || []).map((fold) => el("tr", {},
            el("td", { text: String(fold.fold + 1).padStart(2, "0") }),
            el("td", { text: number(fold.municipios) }),
            el("td", { text: number(fold.positivos) }),
            el("td", { text: Number(fold.auc).toFixed(2) }),
            el("td", { text: Number(fold.ap).toFixed(2) }),
            el("td", { text: percent(fold.precision10, 0) }),
            el("td", { text: `${Number(fold.lift10).toFixed(1)}×` })
          ))
        )
      )
    )
  );
}

function temporalPanel(temporal) {
  if (!temporal) return null;
  return el("div", { class: "panel-box" },
    el("p", { class: "panel-box__title" },
      el("span", { text: "Retrospectivo estatal 2015-2016" }),
      el("span", { text: `${temporal.estados} entidades` })
    ),
    el("div", { class: "metric-strip" },
      el("div", { class: "metric-strip__item" },
        el("div", { class: "metric-strip__value", text: Number(temporal.mae).toFixed(1) }),
        el("div", { class: "metric-strip__label", text: "MAE · fosas" })
      ),
      el("div", { class: "metric-strip__item" },
        el("div", { class: "metric-strip__value", text: Number(temporal.rmse).toFixed(1) }),
        el("div", { class: "metric-strip__label", text: "RMSE · fosas" })
      ),
      el("div", { class: "metric-strip__item" },
        el("div", { class: "metric-strip__value", text: Number(temporal.spearman).toFixed(2) }),
        el("div", { class: "metric-strip__label", text: "Spearman" })
      )
    ),
    el("p", { class: "callout__text", text: temporal.nota })
  );
}

function clusterPanel(clusters) {
  if (!clusters?.clusters?.length) return null;
  return el("div", { class: "panel-box" },
    el("p", { class: "panel-box__title" },
      el("span", { text: "Perfiles territoriales · k-means" }),
      el("span", { text: `${clusters.comunidades?.length || 0} comunidades` })
    ),
    el("div", { class: "cluster-list" },
      ...clusters.clusters.map((cluster) => el("div", { class: "cluster-row" },
        el("div", { class: "cluster-row__head" },
          el("span", { class: "cluster-row__name", text: cluster.nombre }),
          el("span", { class: "eyebrow", text: `${cluster.municipios} municipios` })
        ),
        el("p", { class: "cluster-row__meta", text: `${cluster.estados.join(" · ")}` }),
        el("p", { class: "cluster-row__desc", text: `Tasa histórica media: ${Number(cluster.tasaFosas).toFixed(2)} fosas por 100 mil.` })
      ))
    )
  );
}

export function createModelSection() {
  const content = el("div", { id: "model-content", "aria-live": "polite" },
    el("div", { class: "panel-box" },
      el("p", { class: "panel-box__title", text: "Calculando validación" }),
      el("p", { class: "callout__text", text: "El modelo se entrena al iniciar el servicio con los agregados históricos. Esta sección se llenará en unos segundos." })
    )
  );

  const node = el("section", { class: "section", id: "modelos", "aria-labelledby": "modelos-title" },
    el("div", { class: "section__inner" },
      el("div", { class: "section__head reveal" },
        el("div", {},
          el("p", { class: "section__index", text: "02 / Modelo" }),
          el("h2", { class: "section__title", id: "modelos-title" },
            "No adivina dónde hay una fosa. ", el("em", { text: "Ordena" }), " dónde buscar primero."
          )
        ),
        el("div", { class: "section__lead" },
          el("p", {},
            "El objetivo no es señalar un punto exacto: es ordenar municipios con evidencia histórica, ",
            "incertidumbre visible y un baseline que el modelo debe superar para publicarse."
          ),
          el("p", {},
            "La validación deja entidades completas fuera del entrenamiento. No hay fuga espacial, no se ",
            "promedian años para ocultar resultados y el modelo perdedor se reporta."
          ),
          el("p", {},
            el("a", { class: "text-link", href: "/api/v1/models", target: "_blank", rel: "noopener" },
              "Descargar reporte JSON", icon("external", 12))
          )
        )
      ),
      content
    )
  );

  function render(models, clusters) {
    if (!models) {
      clear(content);
      content.append(el("div", { class: "inline-error" },
        el("strong", { text: "Modelo no disponible" }),
        "No fue posible cargar el reporte de validación. Los datos del mapa siguen disponibles."
      ));
      return;
    }
    const selected = models.modeloSeleccionado;
    const chosen = models.modelos?.find((model) => model.id === selected);
    const baselineWon = selected !== "m2";
    const rationale = baselineWon
      ? `El baseline ${selected.toUpperCase()} ganó: Random Forest no superó su AP en 5% relativo. Se publica el modelo simple y se documenta el resultado negativo, en lugar de esconderlo.`
      : "Random Forest superó al baseline por más del 5% relativo en AP. Aun así, la prioridad es una señal de ordenamiento, no una probabilidad de hallazgo.";

    clear(content);
    content.append(
      el("div", { class: "model-grid" },
        ...(models.modelos || []).map((model) => modelCard(model, model.id === selected))
      ),
      el("div", { class: "model-layout" },
        el("div", {},
          el("div", { class: "callout" },
            el("p", { class: "callout__label", text: "Decisión de publicación" }),
            el("h3", { class: "callout__title", text: chosen ? `Modelo ${chosen.id.toUpperCase()} · ${chosen.nombre}` : "Modelo no disponible" }),
            el("p", { class: "callout__text", text: rationale })
          ),
          el("div", { class: "callout callout--soft"  },
            el("p", { class: "callout__label", text: "Objetivo y límite" }),
            el("p", { class: "callout__text", text: models.objetivo }),
            el("p", { class: "callout__text", text: models.advertencia })
          ),
          foldsPanel(models.folds)
        ),
        el("div", {},
          importancePanel(models.importancia),
          temporalPanel(models.temporal),
          clusterPanel(clusters)
        )
      ),
      el("div", { class: "callout callout--soft"  },
        el("p", { class: "callout__label", text: "Lectura correcta de la prioridad" }),
        el("p", { class: "callout__text" },
          "Una banda A significa que el municipio se parece más a los municipios donde ya se documentaron fosas, ",
          "no que haya una fosa en una coordenada. La ausencia de una banda alta no descarta nada. ",
          "La prioridad sirve para asignar brigadas, no para acusar a un territorio."
        )
      )
    );
  }

  return { node, render };
}

