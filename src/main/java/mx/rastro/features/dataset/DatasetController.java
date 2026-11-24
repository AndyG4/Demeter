package mx.rastro.features.dataset;

import mx.rastro.features.catalog.Catalog;
import mx.rastro.features.records.PersonRecord;
import mx.rastro.features.records.RecordStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.concurrent.atomic.AtomicReference;

@RestController
@RequestMapping(path = "/api/v1", produces = "application/json")
public class DatasetController {

    private final DatasetService datasetService;
    private final AtomicReference<CachedStats> cache = new AtomicReference<>();

    public DatasetController(DatasetService datasetService) {
        this.datasetService = datasetService;
    }

    @GetMapping("/stats")
    public Stats stats() {
        DatasetSnapshot dataset = datasetService.snapshot();
        CachedStats cached = cache.get();
        if (cached != null && cached.version().equals(dataset.version())) {
            return cached.stats();
        }
        long desaparecidas = 0;
        long noLocalizadas = 0;
        long localizadas = 0;
        long confidenciales = 0;
        long sinMunicipio = 0;
        java.util.Set<String> municipiosConRegistros = new java.util.HashSet<>();
        for (PersonRecord record : dataset.records()) {
            switch (record.estatus()) {
                case DESAPARECIDA -> desaparecidas++;
                case NO_LOCALIZADA -> noLocalizadas++;
                case LOCALIZADA -> localizadas++;
                case CONFIDENCIAL -> confidenciales++;
            }
            if (record.municipioId() == null) {
                sinMunicipio++;
            } else {
                municipiosConRegistros.add(record.municipioId());
            }
        }
        long conMunicipio = dataset.records().size() - sinMunicipio;
        LocalDate ultimaFechaMapa = dataset.records().stream()
                .map(PersonRecord::fechaVisto)
                .filter(java.util.Objects::nonNull)
                .max(LocalDate::compareTo)
                .orElse(null);
        LocalDate ultimaFechaNombres = dataset.searchRecords().stream()
                .map(PersonRecord::fechaVisto)
                .filter(java.util.Objects::nonNull)
                .max(LocalDate::compareTo)
                .orElse(null);
        Catalog catalog = dataset.catalog();
        Stats stats = new Stats(
                dataset.records().size(),
                desaparecidas,
                noLocalizadas,
                localizadas,
                confidenciales,
                conMunicipio,
                sinMunicipio,
                municipiosConRegistros.size(),
                catalog.municipalities().size(),
                catalog.states().size(),
                dataset.cutoff(),
                ultimaFechaMapa,
                ultimaFechaNombres,
                dataset.synthetic(),
                dataset.nombresDisponibles(),
                dataset.sourceLabel(),
                dataset.version());
        cache.set(new CachedStats(dataset.version(), stats));
        return stats;
    }

    @GetMapping("/dataset")
    public DatasetInfo dataset() {
        DatasetSnapshot dataset = datasetService.snapshot();
        return new DatasetInfo(dataset.version(), dataset.sourceLabel(), dataset.synthetic(),
                dataset.cutoff(), dataset.records().size(), dataset.loadedAt());
    }

    public record Stats(
            long registros,
            long desaparecidas,
            long noLocalizadas,
            long localizadas,
            long confidenciales,
            long conMunicipio,
            long sinMunicipio,
            int municipiosConRegistros,
            int municipios,
            int estados,
            LocalDate corte,
            LocalDate ultimaFechaMapa,
            LocalDate ultimaFechaNombres,
            boolean sintetico,
            boolean nombresDisponibles,
            String fuente,
            String version) {
    }

    public record DatasetInfo(
            String version,
            String fuente,
            boolean sintetico,
            LocalDate corte,
            int registros,
            java.time.Instant cargadoEn) {
    }

    private record CachedStats(String version, Stats stats) {
    }
}
