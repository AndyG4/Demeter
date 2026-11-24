package mx.rastro.features.geo;

import mx.rastro.features.catalog.Catalog;
import mx.rastro.features.catalog.Municipality;
import mx.rastro.features.catalog.State;
import mx.rastro.features.dataset.DatasetService;
import mx.rastro.features.dataset.DatasetSnapshot;
import mx.rastro.features.records.PersonRecord;
import mx.rastro.features.records.RecordStatus;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;





@Service
public class MunicipalityAggregateService {

    private final DatasetService datasetService;
    private final AtomicReference<Cached> cache = new AtomicReference<>();

    public MunicipalityAggregateService(DatasetService datasetService) {
        this.datasetService = datasetService;
    }

    public List<MunicipalityAggregate> all() {
        DatasetSnapshot dataset = datasetService.snapshot();
        Cached cached = cache.get();
        if (cached != null && cached.version().equals(dataset.version())) {
            return cached.values();
        }
        synchronized (this) {
            cached = cache.get();
            if (cached != null && cached.version().equals(dataset.version())) {
                return cached.values();
            }
            List<MunicipalityAggregate> built = build(dataset);
            cache.set(new Cached(dataset.version(), built));
            return built;
        }
    }

    public List<MunicipalityAggregate> byState(String estadoId) {
        if (estadoId == null || estadoId.isBlank()) {
            return all();
        }
        return all().stream().filter(item -> item.estadoId().equals(estadoId)).toList();
    }

    private List<MunicipalityAggregate> build(DatasetSnapshot dataset) {
        Catalog catalog = dataset.catalog();
        Map<String, int[]> counts = new HashMap<>();
        Map<String, int[]> ages = new HashMap<>();
        for (PersonRecord record : dataset.records()) {
            if (record.municipioId() == null) {
                continue;
            }
            int[] values = counts.computeIfAbsent(record.municipioId(), ignored -> new int[5]);
            values[0]++;
            switch (record.estatus()) {
                case DESAPARECIDA -> values[1]++;
                case NO_LOCALIZADA -> values[2]++;
                case LOCALIZADA -> values[3]++;
                case CONFIDENCIAL -> values[4]++;
            }
            ages.computeIfAbsent(record.municipioId(), ignored -> new int[7])[AgeGroups.index(record.edad())]++;
        }
        List<MunicipalityAggregate> result = new ArrayList<>(catalog.municipalities().size());
        for (Municipality municipality : catalog.allMunicipalities()) {
            int[] values = counts.getOrDefault(municipality.id(), new int[5]);
            int[] ageCounts = ages.getOrDefault(municipality.id(), new int[7]);
            State state = catalog.state(municipality.estadoId());
            double rate = municipality.poblacion() > 0
                    ? Math.round(values[0] * 100_000.0 / municipality.poblacion() * 100.0) / 100.0
                    : 0;
            result.add(new MunicipalityAggregate(
                    municipality.id(),
                    municipality.nombre(),
                    municipality.estadoId(),
                    state == null ? "" : state.nombre(),
                    municipality.lat(),
                    municipality.lon(),
                    municipality.poblacion(),
                    values[0],
                    values[1],
                    values[2],
                    values[3],
                    values[4],
                    rate,
                    AgeGroups.toMap(ageCounts)));
        }
        return List.copyOf(result);
    }

    private record Cached(String version, List<MunicipalityAggregate> values) {
    }
}
