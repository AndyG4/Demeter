import { el } from "./utils/dom.js";
import { api } from "./api.js";
import { setState } from "./store.js";
import { createHome } from "./pages/home.js";
import { initAnimations, refreshScrollTriggers } from "./animations.js";

async function boot() {
  const app = document.querySelector("#app");
  if (!app) return;

  const { page, header, hero, explorer, modelSection } = createHome();
  app.replaceChildren(page);
  initAnimations();

  const statsJob = api.stats()
    .then((value) => {
      applyStats(value);
    })
    .catch((error) => console.warn("No fue posible cargar las estadísticas", error));

  let currentVersion = null;

  function applyStats(value) {
    const changed = currentVersion && currentVersion !== value.version;
    currentVersion = value.version;
    hero.update(value);
    header.setDemo(value.sintetico, value.fuente);
    explorer.setStats(value);
    setState({ stats: value, demo: value.sintetico });
    document.title = `Demeter · ${new Intl.NumberFormat("es-MX").format(value.registros)} registros · Mapa de ausencias en México`;
    return changed;
  }

  async function refreshStats() {
    try {
      const value = await api.stats();
      const changed = applyStats(value);
      if (changed) {
        await Promise.allSettled([
          api.geo().then((geo) => explorer.setGeo(geo)),
          api.municipalities().then((items) => explorer.setMunicipalities(items)),
          api.predictions().then((value) => explorer.setPredictions(value)),
        ]);
        refreshScrollTriggers();
      }
    } catch (error) {
      console.warn("No fue posible actualizar las estadísticas", error);
    }
  }

  window.setInterval(refreshStats, 60_000);

  const geoJob = api.geo()
    .then((value) => {
      explorer.setGeo(value);
      setState({ geo: value });
    })
    .catch((error) => {
      console.warn("No fue posible cargar la geometría", error);
      explorer.setLoadingError("No fue posible cargar los límites estatales. Revisa la conexión con el servidor.");
    });

  const municipalitiesJob = api.municipalities()
    .then((value) => {
      explorer.setMunicipalities(value);
      setState({ municipalities: value });
    })
    .catch((error) => console.warn("No fue posible cargar los agregados municipales", error));

  const predictionsJob = api.predictions()
    .then((value) => {
      explorer.setPredictions(value);
      setState({ predictions: value });
    })
    .catch((error) => console.warn("No fue posible cargar las predicciones", error));

  const modelsJob = Promise.allSettled([api.models(), api.clusters()])
    .then(([modelResult, clusterResult]) => {
      const modelReport = modelResult.status === "fulfilled" ? modelResult.value : null;
      const clusterReport = clusterResult.status === "fulfilled" ? clusterResult.value : null;
      modelSection.render(modelReport, clusterReport);
      setState({ models: modelReport, clusters: clusterReport });
      if (!modelReport) {
        console.warn("No fue posible cargar el reporte del modelo", modelResult.reason);
      }
    });

  await Promise.allSettled([statsJob, geoJob, municipalitiesJob, predictionsJob, modelsJob]);
  refreshScrollTriggers();
}

boot().catch((error) => {
  console.error(error);
  const app = document.querySelector("#app");
  if (app) {
    app.replaceChildren(
      el("div", { class: "noscript" },
        el("h1", { text: "Demeter no pudo iniciar" }),
        el("p", { text: "El servidor no respondió. Recarga la página o revisa la consola del servicio." })
      )
    );
  }
});
