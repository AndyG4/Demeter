import { svg } from "../utils/dom.js";

const ICONS = {
  search: [
    ["circle", { cx: 11, cy: 11, r: 7 }],
    ["path", { d: "m20 20-3.9-3.9" }],
  ],
  arrow: [
    ["path", { d: "M4 12h15" }],
    ["path", { d: "m13 6 6 6-6 6" }],
  ],
  close: [
    ["path", { d: "M6 6l12 12" }],
    ["path", { d: "M18 6 6 18" }],
  ],
  pin: [
    ["path", { d: "M12 21s7-6.1 7-11a7 7 0 0 0-14 0c0 4.9 7 11 7 11Z" }],
    ["circle", { cx: 12, cy: 10, r: 2.4 }],
  ],
  layers: [
    ["path", { d: "m12 3 8 4.5-8 4.5-8-4.5L12 3Z" }],
    ["path", { d: "m4 12 8 4.5 8-4.5" }],
    ["path", { d: "m4 16.5 8 4.5 8-4.5" }],
  ],
  info: [
    ["circle", { cx: 12, cy: 12, r: 9 }],
    ["path", { d: "M12 11v5" }],
    ["path", { d: "M12 8h.01" }],
  ],
  menu: [
    ["path", { d: "M4 7h16" }],
    ["path", { d: "M4 12h16" }],
    ["path", { d: "M4 17h16" }],
  ],
  external: [
    ["path", { d: "M14 4h6v6" }],
    ["path", { d: "M20 4 10 14" }],
    ["path", { d: "M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" }],
  ],
  crosshair: [
    ["circle", { cx: 12, cy: 12, r: 5 }],
    ["path", { d: "M12 2v4" }],
    ["path", { d: "M12 18v4" }],
    ["path", { d: "M2 12h4" }],
    ["path", { d: "M18 12h4" }],
  ],
  arrowUp: [
    ["path", { d: "M12 20V4" }],
    ["path", { d: "m6 10 6-6 6 6" }],
  ],
};

export function icon(name, size = 18) {
  const definition = ICONS[name] || ICONS.info;
  const node = svg("svg", {
    viewBox: "0 0 24 24",
    width: size,
    height: size,
    fill: "none",
    stroke: "currentColor",
    "stroke-width": 1.5,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
    focusable: "false",
  });
  for (const [tag, attrs] of definition) {
    node.append(svg(tag, attrs));
  }
  return node;
}
