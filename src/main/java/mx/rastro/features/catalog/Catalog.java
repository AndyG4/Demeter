package mx.rastro.features.catalog;

import mx.rastro.shared.text.TextNormalizer;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;


public final class Catalog {

    private final Map<String, State> states;
    private final Map<String, Municipality> municipalities;
    private final Map<String, List<Municipality>> byState;
    private final Map<String, List<Municipality>> byStateAndName;
    private final Map<String, List<Municipality>> byName;
    private final Map<String, String> stateIdByName;
    private final List<Municipality> all;

    public Catalog(List<State> states, List<Municipality> municipalities) {
        Map<String, State> stateMap = new LinkedHashMap<>();
        for (State state : states) {
            stateMap.put(state.id(), state);
        }
        Map<String, Municipality> municipalityMap = new LinkedHashMap<>();
        Map<String, List<Municipality>> grouped = new LinkedHashMap<>();
        Map<String, List<Municipality>> groupedByName = new LinkedHashMap<>();
        Map<String, List<Municipality>> globalByName = new LinkedHashMap<>();
        List<Municipality> allList = new ArrayList<>();
        for (Municipality municipality : municipalities) {
            if (!stateMap.containsKey(municipality.estadoId())) {
                continue;
            }
            municipalityMap.put(municipality.id(), municipality);
            grouped.computeIfAbsent(municipality.estadoId(), ignored -> new ArrayList<>()).add(municipality);
            groupedByName.computeIfAbsent(municipality.estadoId() + "|"
                    + TextNormalizer.normalize(municipality.nombre()), ignored -> new ArrayList<>()).add(municipality);
            globalByName.computeIfAbsent(TextNormalizer.normalize(municipality.nombre()),
                    ignored -> new ArrayList<>()).add(municipality);
            allList.add(municipality);
        }
        Map<String, String> names = new LinkedHashMap<>();
        for (State state : stateMap.values()) {
            names.put(TextNormalizer.normalize(state.nombre()), state.id());
        }
        this.states = Collections.unmodifiableMap(stateMap);
        this.municipalities = Collections.unmodifiableMap(municipalityMap);
        Map<String, List<Municipality>> frozen = new LinkedHashMap<>();
        grouped.forEach((key, value) -> frozen.put(key, List.copyOf(value)));
        this.byState = Collections.unmodifiableMap(frozen);
        this.byStateAndName = freeze(groupedByName);
        this.byName = freeze(globalByName);
        this.stateIdByName = Collections.unmodifiableMap(names);
        this.all = List.copyOf(allList);
    }

    private static Map<String, List<Municipality>> freeze(Map<String, List<Municipality>> source) {
        Map<String, List<Municipality>> frozen = new LinkedHashMap<>();
        source.forEach((key, value) -> frozen.put(key, List.copyOf(value)));
        return Collections.unmodifiableMap(frozen);
    }

    public Map<String, State> states() {
        return states;
    }

    public Map<String, Municipality> municipalities() {
        return municipalities;
    }

    public List<Municipality> municipalitiesOf(String stateId) {
        return byState.getOrDefault(stateId, List.of());
    }

    public Map<String, List<Municipality>> byState() {
        return byState;
    }

    public List<Municipality> allMunicipalities() {
        return all;
    }

    public Municipality municipality(String id) {
        return municipalities.get(id);
    }

    public State state(String id) {
        return states.get(id);
    }

    public String stateIdByName(String name) {
        String normalized = TextNormalizer.normalize(name);
        String direct = stateIdByName.get(normalized);
        if (direct != null) {
            return direct;
        }
        for (State state : states.values()) {
            String candidate = TextNormalizer.normalize(state.nombre());
            if (candidate.startsWith(normalized + " ") || normalized.startsWith(candidate + " ")) {
                return state.id();
            }
        }
        return null;
    }

    public State stateOf(Municipality municipality) {
        return states.get(municipality.estadoId());
    }

    




    public Municipality municipalityByName(String stateNameOrId, String municipalityName) {
        String normalizedName = TextNormalizer.normalize(municipalityName);
        if (normalizedName.isBlank()) {
            return null;
        }
        String stateId = null;
        if (stateNameOrId != null && !stateNameOrId.isBlank()) {
            String trimmed = stateNameOrId.trim();
            stateId = trimmed.matches("\\d{2}") && states.containsKey(trimmed)
                    ? trimmed
                    : stateIdByName(trimmed);
        }
        List<Municipality> candidates = null;
        if (stateId != null) {
            candidates = byStateAndName.get(stateId + "|" + normalizedName);
        }
        if (candidates == null || candidates.isEmpty()) {
            candidates = byName.get(normalizedName);
        }
        if (candidates == null || candidates.isEmpty()) {
            return null;
        }
        return candidates.stream()
                .max(java.util.Comparator.comparingInt(Municipality::poblacion))
                .orElse(candidates.getFirst());
    }
}
