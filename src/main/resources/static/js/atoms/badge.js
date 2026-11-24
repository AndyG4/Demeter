import { el } from "../utils/dom.js";

export function statusPill(estatus, etiqueta) {
  const located = estatus === "LOCALIZADA";
  return el(
    "span",
    { class: `pill ${located ? "pill--located" : "pill--missing"}` },
    el("span", { class: "pill__dot", "aria-hidden": "true" }),
    etiqueta || (located ? "Localizada" : "Sin localizar")
  );
}

export function demoPill(label = "Demo") {
  return el("span", { class: "pill pill--demo" }, label);
}
