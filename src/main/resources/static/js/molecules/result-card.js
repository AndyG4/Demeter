import { el } from "../utils/dom.js";
import { icon } from "../atoms/icon.js";
import { statusPill } from "../atoms/badge.js";
import { date } from "../utils/format.js";

export function createResultCard(hit, index, onSelect) {
  const card = el("a", {
    class: "result-card",
    href: "#ficha",
    "data-id": hit.id,
    "aria-label": `Ver ficha de ${hit.nombre}`,
    on: {
      click: (event) => {
        event.preventDefault();
        onSelect(hit, card);
      },
    },
  },
    el("div", { class: "result-card__top" },
      el("span", { class: "result-card__index", text: String(index + 1).padStart(2, "0") }),
      statusPill(hit.estatus, hit.estatusEtiqueta)
    ),
    el("div", { class: "result-card__name", text: hit.nombre }),
    el("dl", { class: "result-card__meta" },
      el("div", {},
        el("dt", { text: "Edad" }),
        el("dd", { text: hit.edad == null ? "Sin dato" : `${hit.edad} años` })
      ),
      el("div", {},
        el("dt", { text: "Última vez" }),
        el("dd", { text: date(hit.fechaVisto) })
      )
    ),
    el("div", { class: "result-card__foot" },
      el("span", { class: "result-card__place" },
        icon("pin", 12),
        el("span", { text: hit.municipio === hit.estado ? hit.municipio : `${hit.municipio}, ${hit.estado}` })
      ),
      el("span", { class: "result-card__quality", text: hit.coincidencia })
    )
  );
  return card;
}
