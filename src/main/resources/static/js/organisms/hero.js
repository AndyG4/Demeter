import { el } from "../utils/dom.js";
import { icon } from "../atoms/icon.js";
import { date, number } from "../utils/format.js";
import { prefersReducedMotion } from "../utils/motion.js";
import { createHeroAtmosphere } from "../hero-atmosphere.js";

function line(content, className = "") {
  return el("span", { class: `hero__title-line ${className}`.trim() },
    el("span", { class: "js-hero-line", ...(typeof content === "string" ? { text: content } : {}) },
      ...(typeof content === "string" ? [] : [content])
    )
  );
}

export function createHero() {
  const values = {
    registros: el("span", { class: "hero-stat__value", "data-stat": "registros", text: "—" }),
    estados: el("span", { class: "hero-stat__value", "data-stat": "estados", text: "—" }),
    municipios: el("span", { class: "hero-stat__value", "data-stat": "municipios", text: "—" }),
    corte: el("span", { class: "hero-stat__value hero-stat__value--date", "data-stat": "corte", text: "—" }),
  };

  const cardNote = el("p", { class: "hero__card-note" });

  const searchButton = el("button", {
    class: "btn btn--solid",
    type: "button",
    on: {
      click: () => {
        document.querySelector("#mapa")?.scrollIntoView({ behavior: "smooth", block: "start" });
        window.setTimeout(() => document.querySelector("#search-input")?.focus(), 450);
      },
    },
  }, "Buscar a una persona", icon("search", 14));

  const node = el("section", { class: "hero", id: "inicio", "aria-labelledby": "hero-title" },
    el("div", { class: "hero__inner" },
      el("div", { class: "hero__copy" },
        el("p", { class: "hero__eyebrow", text: "Mapa público · México" }),
        el("h1", { class: "hero__title", id: "hero-title" },
          line("Cada punto"),
          line(el("span", {}, "es una ", el("em", { text: "persona" }))),
          line("que alguien busca.")
        ),
        el("p", { class: "hero__lead" },
          "Demeter cruza registros públicos, geometría municipal y un modelo auditable para ordenar ",
          "dónde buscar primero. No sustituye una denuncia, una búsqueda oficial ni el trabajo de las familias."
        ),
        el("div", { class: "hero__actions" },
          searchButton,
          el("a", { class: "btn btn--ghost", href: "#modelos" }, "Leer el método", icon("arrow", 14))
        ),
        el("div", { class: "hero__meta" },
          el("span", { class: "hero__meta-item" },
            el("span", { class: "hero__meta-key", text: "Cobertura" }),
            el("span", { class: "hero__meta-value", text: "32 entidades · 2,469 municipios" })
          ),
          el("span", { class: "hero__meta-item" },
            el("span", { class: "hero__meta-key", text: "Fuentes" }),
            el("span", { class: "hero__meta-value", text: "RNPDNO · A dónde van los Desaparecidos · PCDF · INEGI" })
          ),
          el("span", { class: "hero__meta-item" },
            el("span", { class: "hero__meta-key", text: "Corte" }),
            el("span", { class: "hero__meta-value", "data-hero-cutoff": "", text: "—" })
          )
        )
      ),
      el("aside", { class: "hero__card", "aria-label": "Resumen del expediente" },
        el("div", { class: "hero__card-head" },
          el("span", { class: "hero__card-kicker", text: "Expediente" }),
          el("span", { class: "hero__card-year", text: "México / 2026" })
        ),
        el("div", { class: "hero__stats" },
          el("div", { class: "hero-stat" },
            el("span", { class: "hero-stat__label", text: "Registros cargados" }),
            el("span", {}, values.registros)
          ),
          el("div", { class: "hero-stat" },
            el("span", { class: "hero-stat__label", text: "Entidades" }),
            el("span", {}, values.estados)
          ),
          el("div", { class: "hero-stat" },
            el("span", { class: "hero-stat__label", text: "Municipios" }),
            el("span", {}, values.municipios)
          ),
          el("div", { class: "hero-stat" },
            el("span", { class: "hero-stat__label", text: "Último corte" }),
            el("span", {}, values.corte)
          )
        ),
        cardNote
      )
    )
  );

  function update(stats) {    if (!stats) return;
    countTo(values.registros, stats.registros);
    countTo(values.estados, stats.estados);
    countTo(values.municipios, stats.municipios);
    values.corte.textContent = date(stats.corte);
    const cutoff = node.querySelector("[data-hero-cutoff]");
    if (cutoff) cutoff.textContent = date(stats.corte);
    cardNote.textContent = stats.sintetico
      ? "Registros sintéticos de demostración. No corresponden a personas reales."
      : `${stats.registros.toLocaleString("es-MX")} registros reales anonimizados · sin nombres públicos · fuente: ${stats.fuente}.`;
    cardNote.hidden = false;
  }

  function countTo(node, value) {
    const target = Number(value) || 0;
    if (!window.gsap || prefersReducedMotion() || target === 0) {
      node.textContent = number(target);
      return;
    }
    const counter = { value: 0 };
    window.gsap.to(counter, {
      value: target,
      duration: 1.1,
      ease: "power2.out",
      onUpdate: () => {
        node.textContent = number(Math.round(counter.value));
      },
    });
  }

  const destroyAtmosphere = createHeroAtmosphere(node);

  return { node, update, destroy: destroyAtmosphere };
}
