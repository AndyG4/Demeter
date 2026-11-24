const state = {
  stats: null,
  geo: null,
  predictions: null,
  models: null,
  clusters: null,
  layer: "registros",
  selectedState: "",
  demo: true,
};

const listeners = new Set();

export function getState() {
  return state;
}

export function setState(patch) {
  Object.assign(state, patch);
  for (const listener of listeners) {
    listener(state);
  }
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
