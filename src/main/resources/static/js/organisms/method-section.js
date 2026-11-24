import { el } from "../utils/dom.js";

function step(number, title, text) {
  return el("article", { class: "step" },
    el("p", { class: "step__number", text: number }),
    el("h3", { class: "step__title", text: title }),
    el("p", { class: "step__text", text })
  );
}

export function createMethodSection() {
  return el("section", { class: "section", id: "metodo", "aria-labelledby": "metodo-title" },
    el("div", { class: "section__inner" },
      el("div", { class: "section__head reveal" },
        el("div", {},
          el("p", { class: "section__index", text: "04 / Método" }),
          el("h2", { class: "section__title", id: "metodo-title" },
            "Cómo funciona, ", el("em", { text: "sin caja negra" }), "."
          )
        ),
        el("div", { class: "section__lead" },
          el("p", {},
            "La búsqueda y la prioridad son dos motores distintos. El primero resuelve nombres; el segundo ",
            "ordena territorios. Ambos están diseñados para responder rápido y para no exponer más datos de los necesarios."
          )
        )
      ),
      el("div", { class: "steps" },
        step("01", "Normaliza", "Mayúsculas, acentos, ñ, signos y errores de tecleo se reducen a una forma estable. El mismo tratamiento empareja catálogos y registros."),
        step("02", "Indexa", "Un índice de tokens, trigramas y claves fonéticas evita recorrer los 14 mil registros en cada consulta. La instantánea se reemplaza completa al actualizar datos."),
        step("03", "Valida", "Ocho folds espaciales dejan entidades completas fuera. El baseline, KDE y Random Forest se comparan con AP, AUC, precisión y lift; el ganador se publica."),
        step("04", "Ordena", "La prioridad municipal combina la evidencia histórica con la incertidumbre. Bandas A, B y C, nunca porcentajes de certeza sobre una fosa."),
      ),
      el("div", { class: "method-grid" },
        el("div", {},
          el("h3", { class: "callout__label", text: "Complejidad" }),
          el("div", { class: "table-wrap" },
            el("table", { class: "data-table" },
              el("thead", {},
                el("tr", {},
                  el("th", { text: "Etapa" }),
                  el("th", { text: "Tiempo" }),
                  el("th", { text: "Espacio" })
                )
              ),
              el("tbody", {},
                el("tr", {}, el("td", { text: "Índice de búsqueda" }), el("td", { text: "O(N · L)" }), el("td", { text: "O(N · L)" })),
                el("tr", {}, el("td", { text: "Consulta difusa" }), el("td", { text: "O(C · L² + k log k)" }), el("td", { text: "O(C)" })),
                el("tr", {}, el("td", { text: "KDE espacial" }), el("td", { text: "O(M · S)" }), el("td", { text: "O(M)" })),
                el("tr", {}, el("td", { text: "Random Forest" }), el("td", { text: "O(T · N log N · d)" }), el("td", { text: "O(T · N)" })),
                el("tr", {}, el("td", { text: "K-means" }), el("td", { text: "O(N · K · d · i)" }), el("td", { text: "O(N · K)" })),
                el("tr", {}, el("td", { text: "Grafo kNN" }), el("td", { text: "O(M²)" }), el("td", { text: "O(M²)" }))
              )
            )
          ),
          el("p", { class: "search-form__hint", text: "N: registros · L: longitud del nombre · C: candidatos acotados · M: municipios · S: entidades · T: árboles · d: variables · i: iteraciones. El detalle está en docs/ARQUITECTURA.md." })
        ),
        el("div", {},
          el("h3", { class: "callout__label", text: "Seguridad y privacidad" }),
          el("ul", { class: "security-list" },
            el("li", { text: "CSP estricta, sin scripts, fuentes ni estilos de terceros. Todo se sirve desde el mismo origen." }),
            el("li", { text: "Límite de tasa por IP: 120 solicitudes por minuto; 30 búsquedas por minuto." }),
            el("li", { text: "Búsqueda mínima de 3 letras y máximo de 25 resultados. Sin endpoints de listado o descarga." }),
            el("li", { text: "Datos mínimos: sin direcciones, teléfonos, documentos, fotografías ni familiares." }),
            el("li", { text: "Carga local con validación, límite de filas y hash de versión. Sin escritura remota ni SSRF." }),
            el("li", { text: "Sin login por diseño: no hay cuentas, cookies de sesión ni perfiles de usuarios." })
          )
        )
      )
    )
  );
}
