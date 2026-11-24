import { el } from "../utils/dom.js";
import { icon } from "../atoms/icon.js";

const LINKS = [
  ["Mapa", "#mapa"],
  ["Modelo", "#modelos"],
  ["Datos", "#datos"],
  ["Método", "#metodo"],
];

export function createHeader() {
  const nav = el("nav", { class: "site-nav", "aria-label": "Navegación principal" },
    ...LINKS.map(([label, href]) => el("a", { class: "site-nav__link", href, text: label }))
  );

  const mobileMenu = el("div", { class: "mobile-menu", id: "mobile-menu", hidden: true },
    el("div", { class: "mobile-menu__inner" },
      ...LINKS.map(([label, href]) => el("a", {
        class: "mobile-menu__link",
        href,
        text: label,
        on: { click: () => closeMenu() },
      }))
    )
  );

  const toggle = el("button", {
    class: "menu-toggle",
    type: "button",
    "aria-label": "Abrir menú",
    "aria-expanded": "false",
    "aria-controls": "mobile-menu",
    on: {
      click: () => {
        const open = mobileMenu.hidden;
        mobileMenu.hidden = !open;
        mobileMenu.classList.toggle("is-open", open);
        toggle.setAttribute("aria-expanded", String(open));
        toggle.replaceChildren(icon(open ? "close" : "menu", 18));
      },
    },
  }, icon("menu", 18));

  function closeMenu() {
    mobileMenu.hidden = true;
    mobileMenu.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.replaceChildren(icon("menu", 18));
  }

  const header = el("header", { class: "site-header" },
    el("div", { class: "site-header__inner" },
      el("a", { class: "brand", href: "#inicio", "aria-label": "Demeter, inicio" },
        el("span", {},
          el("span", { class: "brand__name", text: "Demeter" }),
          el("span", { class: "brand__sub", text: "Mapa de ausencias" })
        )
      ),
      nav,
      el("div", { class: "header-actions" },
        el("span", { class: "header-edition", text: "México · 2026" }),
        toggle
      )
    ),
    mobileMenu
  );

  function setDemo(isDemo, source) {
    header.dataset.mode = isDemo ? "demo" : "real";
    header.title = isDemo
      ? "Esta instalación usa registros sintéticos de demostración; no corresponden a personas reales."
      : `Fuente: ${source || "archivo local"}`;
  }

  return { node: header, setDemo };
}
