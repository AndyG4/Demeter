package mx.rastro.features.geo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import mx.rastro.features.catalog.Catalog;
import mx.rastro.features.dataset.DatasetService;
import mx.rastro.features.dataset.DatasetSnapshot;
import mx.rastro.features.predictions.PredictionCell;
import mx.rastro.features.predictions.PredictionService;
import mx.rastro.features.records.PersonRecord;
import mx.rastro.features.records.RecordStatus;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;


@Service
public class GeoJsonService {

    private final ResourceLoader resourceLoader;
    private final DatasetService datasetService;
    private final PredictionService predictionService;
    private final ObjectMapper objectMapper;
    private final AtomicReference<Cached> cache = new AtomicReference<>();

    public GeoJsonService(ResourceLoader resourceLoader, DatasetService datasetService,
                          PredictionService predictionService, ObjectMapper objectMapper) {
        this.resourceLoader = resourceLoader;
        this.datasetService = datasetService;
        this.predictionService = predictionService;
        this.objectMapper = objectMapper;
    }

    public Cached geoJson() {
        DatasetSnapshot dataset = datasetService.snapshot();
        Cached cached = cache.get();
        if (cached != null && cached.version().equals(dataset.version())) {
            return cached;
        }
        synchronized (this) {
            cached = cache.get();
            if (cached != null && cached.version().equals(dataset.version())) {
                return cached;
            }
            Cached built = build(dataset);
            cache.set(built);
            return built;
        }
    }

    private Cached build(DatasetSnapshot dataset) {
        Catalog catalog = dataset.catalog();
        Map<String, long[]> counts = new HashMap<>();
        Map<String, int[]> ages = new HashMap<>();
        Map<String, Integer> population = new HashMap<>();
        for (var municipality : catalog.allMunicipalities()) {
            population.merge(municipality.estadoId(), municipality.poblacion(), Integer::sum);
        }
        for (PersonRecord record : dataset.records()) {
            var municipality = record.municipioId() == null ? null : catalog.municipality(record.municipioId());
            String estadoId = municipality != null ? municipality.estadoId() : record.estadoId();
            if (estadoId == null) {
                continue;
            }
            long[] values = counts.computeIfAbsent(estadoId, ignored -> new long[4]);
            values[0]++;
            if (record.estatus() == RecordStatus.LOCALIZADA) {
                values[2]++;
            } else if (record.estatus() == RecordStatus.CONFIDENCIAL) {
                values[3]++;
            } else {
                values[1]++;
            }
            ages.computeIfAbsent(estadoId, ignored -> new int[7])[AgeGroups.index(record.edad())]++;
        }

        Map<String, List<Double>> priorities = new HashMap<>();
        Map<String, Double> expectedFosas = new HashMap<>();
        for (PredictionCell cell : predictionService.cells(null, 0)) {
            priorities.computeIfAbsent(cell.estadoId(), ignored -> new ArrayList<>()).add(cell.prioridad());
            expectedFosas.merge(cell.estadoId(), cell.fosasEsperadas(), Double::sum);
        }
        Map<String, Double> statePriority = new HashMap<>();
        for (Map.Entry<String, List<Double>> entry : priorities.entrySet()) {
            double value = entry.getValue().stream()
                    .sorted(Comparator.reverseOrder())
                    .limit(5)
                    .mapToDouble(Double::doubleValue)
                    .average()
                    .orElse(0);
            statePriority.put(entry.getKey(), value);
        }

        try (InputStream in = resourceLoader.getResource("classpath:data/estados.geo.json").getInputStream()) {
            JsonNode root = objectMapper.readTree(new String(in.readAllBytes(), StandardCharsets.UTF_8));
            ArrayNode features = (ArrayNode) root.get("features");
            for (JsonNode feature : features) {
                ObjectNode properties = (ObjectNode) feature.get("properties");
                String id = catalog.stateIdByName(properties.path("name").asText());
                properties.put("estadoId", id == null ? "" : id);
                long[] values = id == null ? null : counts.get(id);
                properties.put("registros", values == null ? 0 : values[0]);
                properties.put("desaparecidas", values == null ? 0 : values[1]);
                properties.put("localizadas", values == null ? 0 : values[2]);
                properties.put("confidenciales", values == null ? 0 : values[3]);
                int statePopulation = id == null ? 0 : population.getOrDefault(id, 0);
                double stateRate = statePopulation > 0 && values != null
                        ? Math.round(values[0] * 100_000.0 / statePopulation * 100.0) / 100.0
                        : 0;
                properties.put("poblacion", statePopulation);
                properties.put("tasaPor100k", stateRate);
                int[] stateAges = id == null ? null : ages.get(id);
                properties.set("gruposEdad", objectMapper.valueToTree(
                        AgeGroups.toMap(stateAges == null ? new int[7] : stateAges)));
                properties.put("prioridad", Math.round(statePriority.getOrDefault(id, 0.0) * 10.0) / 10.0);
                properties.put("fosasEsperadas", Math.round(expectedFosas.getOrDefault(id, 0.0) * 10.0) / 10.0);
            }
            byte[] bytes = objectMapper.writeValueAsBytes(root);
            String etag = "\"" + Integer.toHexString(java.util.Arrays.hashCode(bytes)) + "\"";
            return new Cached(dataset.version(), bytes, etag);
        } catch (IOException ex) {
            throw new IllegalStateException("No fue posible preparar el GeoJSON", ex);
        }
    }

    public record Cached(String version, byte[] bytes, String etag) {
    }
}
