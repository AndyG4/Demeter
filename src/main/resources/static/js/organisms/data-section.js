import { el } from "../utils/dom.js";
import { icon } from "../atoms/icon.js";

function sourceCard(name, status, description, meta) {
  return el("article", { class: "source-card" },
    el("div", { class: "source-card__top" },
      el("h3", { class: "source-card__name", text: name }),
      el("span", { class: "source-card__status", text: status })
    ),
    el("p", { class: "source-card__desc", text: description }),
    el("div", { class: "source-card__meta" }, ...meta.map((item) => el("span", { text: item })))
  );
}

function qualityItem(value, label, href, linkLabel) {
  return el("div", { class: "quality-item" },
    el("p", { class: "quality-item__value", text: value }),
    el("p", { class: "quality-item__label" },
      label, " ",
      href ? el("a", { href, target: "_blank", rel: "noopener noreferrer" }, linkLabel || "Fuente", " ", icon("external", 10)) : null
    )
  );
}

function evidenceCard(value, label, description, sourceLabel, href) {
  return el("article", { class: "evidence-card" },
    el("p", { class: "evidence-card__value", text: value }),
    el("p", { class: "evidence-card__label", text: label }),
    el("p", { class: "evidence-card__text", text: description }),
    el("a", {
      class: "evidence-card__source",
      href,
      target: "_blank",
      rel: "noopener noreferrer",
    }, sourceLabel, " ", icon("external", 9))
  );
}

function legalNotice() {
  return el("div", { class: "legal-note" },
    el("p", { class: "callout__label", text: "Fichas públicas · RRA 09082/20" }),
    el("p", { class: "callout__text" },
      "En cumplimiento a lo dispuesto por el Instituto Nacional de Transparencia, Acceso a la Información y Protección de Datos Personales, en la resolución emitida en el RRA 09082/20, solo se visualizan las fichas de las personas desaparecidas y no localizadas cuyos familiares han otorgado su consentimiento para que se haga pública o bien, que no se ha registrado el sentido de la manifestación respecto a que dicha información se haga o no pública."
    ),
    el("p", { class: "legal-note__meta" },
      "Demeter usa una versión pública anonimizada para el mapa. No consulta el RNPDNO en vivo, no accede a fichas restringidas y no permite descargar fichas personales. La base local no incorpora el campo de consentimiento, por lo que no se presenta como un filtro jurídico verificable."
    )
  );
}

function gravesEvidence() {
  return el("div", { class: "evidence-panel reveal" },
    el("div", { class: "evidence-panel__head" },
      el("div", {},
        el("p", { class: "section__index", text: "Fosas localizadas · evidencia pública" }),
        el("h3", { class: "evidence-panel__title" },
          "Lo documentado hasta ", el("em", { text: "2026" }), "."
        )
      ),
      el("p", { class: "evidence-panel__note" },
        "No existe un Registro Nacional de Fosas públicas actualizado. Estas cifras son ",
        "locales o de organizaciones civiles, con fechas y universos distintos: ",
        "no se suman entre sí ni se agregan al total de personas desaparecidas."
      )
    ),
    el("div", { class: "evidence-grid" },
      evidenceCard("651", "fosas en registros estatales · 2025",
        "Frente a 32 fosas reportadas por la FGR en el mismo año. La brecha es de hasta 20 veces.",
        "Plataforma Ciudadana de Fosas · 20 oct 2026",
        "https://laopinion.com/2026/10/21/ong-denuncian-que-la-fiscalia-general-de-mexico-reporta-hasta-20-veces-menos-fosas-clandestinas-que-autoridades-estatales/"),
      evidenceCard("+2,000", "cuerpos exhumados documentados",
        "La FGR sigue sin publicar el Registro Nacional de Fosas Comunes y Fosas Clandestinas que ordena la ley.",
        "Centro Prodh · 12 feb 2026",
        "https://centroprodh.org.mx/sididh4_0/2026/02/12/"),
      evidenceCard("120", "cuerpos en fosas del Edomex · ene 2020–jun 2026",
        "Dos fosas y cinco cuerpos en 2025; seis fosas y diez víctimas entre enero y el 18 de junio de 2026.",
        "Milenio · 2026",
        "https://amp.milenio.com/policia/hallan-120-cuerpos-fosas-edomex-61-siguen-identificados"),
      evidenceCard("26 / 51", "fosas / osamentas en Miguel Alemán · nov 2026",
        "Hallazgos en el Valle de Mexicali. Es una cifra local: no representa un total nacional.",
        "Zeta Tijuana · nov 2026",
        "https://zetatijuana.com/2026/11/suman-26-fosas-clandestinas-y-51-osamentas-en-el-poblado-miguel-aleman/")
    )
  );
}

export function createDataSection() {
  return el("section", { class: "section", id: "datos", "aria-labelledby": "datos-title" },
    el("div", { class: "section__inner" },
      el("div", { class: "section__head reveal" },
        el("div", {},
          el("p", { class: "section__index", text: "03 / Datos" }),
          el("h2", { class: "section__title", id: "datos-title" },
            "Los datos tienen fecha, unidad y ", el("em", { text: "límite" }), "."
          )
        ),
        el("div", { class: "section__lead" },
          el("p", {},
            "Un registro no es una persona. Una fosa no es un cuerpo. Un conteo no es una serie comparable. ",
            "Demeter conserva la unidad y el corte de cada cifra y evita sumar universos distintos."
          ),
          el("p", {},
            "La capa municipal combina la base 2025 con los hechos nuevos de abril de 2026. La búsqueda usa nombres públicos de Data Cívica hasta 2023. ",
            "La capa territorial se entrena con agregados públicos reales de fosas documentadas."
          )
        )
      ),
      el("div", { class: "source-grid" },
        sourceCard("RNPDNO · 2025 + abril 2026", "Personas anonimizadas",
          "Base 2025 de 133,887 personas + 3,696 hechos nuevos de abril 2026 = 137,583 personas únicas. Sin nombres; municipio cuando la fuente lo permite.",
          ["137,583 únicas", "corte abr 2026", "sin nombres"]),
        sourceCard("RNPDNO · historia municipal 2015-2024", "M3 · entrenamiento",
          "Historia agregada de registros públicos anonimizados por municipio. M3 usa esta señal sólo hasta 2024; 2025 y 2026 quedan fuera del entrenamiento y de la selección de hiperparámetros.",
          ["M3 challenger", "2025-26 fuera", "anonimizado"]),
        sourceCard("A dónde van los Desaparecidos", "Fosas 2006-2016",
          "1,957 fosas documentadas por entidad y año. Base periodística abierta que permite un baseline y un KDE honestos, con la advertencia de que la serie termina en 2016.",
          ["32 entidades", "11 años", "atribución"]),
        sourceCard("Plataforma Ciudadana de Fosas", "Presencia municipal",
          "788 municipios con al menos un hallazgo documentado entre 2006 y 2024. La API es pública pero no declara licencia: para producción se debe solicitar autorización a las organizaciones responsables.",
          ["2,469 municipios", "18 años", "API pública"]),
        sourceCard("INEGI + GeoNames", "Geometría y población",
          "Límites estatales, claves municipales y población aproximada para ponderar. Los códigos municipales se alinean con el catálogo INEGI.",
          ["32 estados", "2,469 municipios", "datos abiertos"])
      ),
      legalNotice(),
      el("div", { class: "quality-grid" },
        qualityItem("132,534", "Registros vigentes reportados por la autoridad. No son personas únicas ni una serie estable.", "https://www.elimparcial.com/mexico/2026/03/27/claudia-sheinbaum-reconoce-132-mil-desaparecidos-en-mexico-y-presenta-informe-nacional-con-reformas-512-instituciones-involucradas-y-nuevos-protocolos-de-busqueda-obligatoria/", "mar 2026"),
        qualityItem("43,128", "Personas realmente vigentes según la revisión oficial citada por Data Cívica. La diferencia con el total es parte del problema de registro.", "https://datacivica.org/comunicado-a-quienes-nos-faltan-2026/", "ago 2026"),
        qualityItem("38.5%", "Registros confidencializados, fuera de la consulta pública. Un modelo entrenado con lo visible aprende también ese sesgo.", "https://datacivica.org/comunicado-a-quienes-nos-faltan-2026/", "ago 2026")
      ),
      gravesEvidence(),
      el("div", { class: "callout callout--soft" },
        el("p", { class: "callout__label", text: "Sobre los datos reales" }),
        el("p", { class: "callout__text" },
          "Que un registro no esté confidencializado no significa que el padrón se pueda descargar. ",
          "La base del mapa es 2025 + abril 2026: 137,583 personas únicas, sin nombres. ",
          "La búsqueda por nombre usa la versión pública de Data Cívica, que sólo publica entidad."
        )
      ),
      el("div", { class: "data-columns" },
        el("div", {},
          el("h3", { class: "callout__label", text: "Actualización" }),
          el("p", { class: "section__lead" },
            "El corte y los registros cargados se refrescan cada minuto. Si cambia la versión, se recargan los agregados municipales, la geometría y las predicciones sin reiniciar el servicio."
          )
        ),
        el("div", {},
          el("h3", { class: "callout__label", text: "Lo que este sitio no hace" }),
          el("ul", { class: "not-list" },
            el("li", { text: "No recibe denuncias ni sustituye una búsqueda oficial. Si buscas a alguien, acude a la CNB o a la fiscalía." }),
            el("li", { text: "No publica listados masivos ni permite descargar el padrón de personas." }),
            el("li", { text: "No infiere autoría, motivación ni pertenencia a un grupo criminal." }),
            el("li", { text: "No evade captchas, controles de acceso ni términos de uso." }),
            el("li", { text: "No usa bases filtradas sin anonimizar: la capa municipal es la versión anonimizada publicada por Data Cívica." }),
            el("li", { text: "No promete precisión puntual: ordena prioridades con incertidumbre." })
          ),
          el("div", { class: "callout callout--soft" },
            el("p", { class: "callout__label", text: "Sobre la comparación" }),
            el("p", { class: "callout__text" },
              "Demeter no copia los resultados de la Plataforma Ciudadana de Fosas. Usa la presencia documentada ",
              "por municipio como etiqueta de validación y reporta el resultado. La comparación metodológica ",
              "está en la documentación del proyecto."
            )
          )
        )
      )
    )
  );
}
