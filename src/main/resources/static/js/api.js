const BASE = "/api/v1";

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request(path, { signal } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const message =
      payload?.message ||
      (response.status === 429
        ? "Demasiadas solicitudes. Espera un momento."
        : "No fue posible consultar el servidor.");
    throw new ApiError(message, response.status, payload?.code);
  }
  return payload;
}

export const api = {
  stats: (options) => request("/stats", options),
  geo: (options) => request("/geo/estados", options),
  municipalities: (options) => request("/geo/municipios", options),
  municipalityRecords: (id, limit = 50, status = "", options) =>
    request(`/geo/municipios/${encodeURIComponent(id)}/registros?limit=${limit}${status ? `&estatus=${encodeURIComponent(status)}` : ""}`, options),
  predictions: (options) => request("/predictions", options),
  models: (options) => request("/models", options),
  clusters: (options) => request("/clusters", options),
  search(params, options) {
    const query = new URLSearchParams();
    query.set("q", params.q);
    if (params.estado) query.set("estado", params.estado);
    if (params.estatus) query.set("estatus", params.estatus);
    if (params.anio) query.set("anio", params.anio);
    query.set("limit", String(params.limit || 25));
    return request(`/search?${query.toString()}`, options);
  },
};
