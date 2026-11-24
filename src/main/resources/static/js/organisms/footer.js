import { el } from "../utils/dom.js";

function column(title, links) {
  return el("div", {},
    el("p", { class: "site-footer__heading", text: title }),
    el("div", { class: "site-footer__links" },
      ...links.map(([label, href]) => el("a", {
        href,
        text: label,
        ...(href.startsWith("http") ? { target: "_blank", rel: "noopener" } : {}),
      }))
    )
  );
}

export function createFooter() {
  return el("footer", { class: "site-footer" },
    el("div", { class: "site-footer__inner" },
      el("div", { class: "site-footer__top" },
        el("div", {},
          el("p", { class: "site-footer__brand", text: "Demeter" }),
          el("p", { class: "site-footer__tagline" },
            "Un mapa de ausencias construido con datos públicos, métodos explícitos y límites visibles. ",
            "No es una herramienta de denuncia ni un padrón."
          )
        ),
        column("Explorar", [
          ["Mapa", "#mapa"],
          ["Modelo", "#modelos"],
          ["Datos", "#datos"],
          ["Método", "#metodo"],
        ]),
        column("Fuentes", [
          ["RNPDNO", "https://versionpublicarnpdno.segob.gob.mx/"],
          ["A dónde van los Desaparecidos", "https://data.adondevanlosdesaparecidos.org/"],
          ["Plataforma Ciudadana de Fosas", "https://plataformaciudadanadefosas.org/"],
          ["INEGI", "https://www.inegi.org.mx/"],
        ]),
        column("Proyecto", [
          ["Reporte del modelo", "/api/v1/models"],
          ["Ficha de datos", "/api/v1/dataset"],
          ["Estado del servicio", "/api/v1/health"],
          ["Comisión Nacional de Búsqueda", "https://www.gob.mx/cnb"],
        ])
      ),
      el("div", { class: "site-footer__bottom" },
        el("span", { text: "Demeter · 2026 · Hecho con datos públicos y métodos explícitos" }),
        el("span", { text: "Sin login. Sin cookies de sesión. Sin venta de datos." }),
        el("span", { text: "Si buscas a una persona, acude a la autoridad: este sitio no recibe denuncias." })
      )
    )
  );
}
