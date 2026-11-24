const numberFormatter = new Intl.NumberFormat("es-MX");
const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const shortDateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "2-digit",
});

export function number(value) {
  return Number.isFinite(Number(value)) ? numberFormatter.format(Number(value)) : "—";
}

export function date(value) {
  if (!value) return "Sin fecha";
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? String(value) : dateFormatter.format(parsed);
}

export function shortDate(value) {
  if (!value) return "—";
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? String(value) : shortDateFormatter.format(parsed);
}

export function decimal(value, digits = 2) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—";
}

export function percent(value, digits = 1) {
  return Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(digits)}%` : "—";
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
