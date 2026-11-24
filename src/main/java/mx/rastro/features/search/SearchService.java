package mx.rastro.features.search;

import mx.rastro.features.catalog.Catalog;
import mx.rastro.features.catalog.Municipality;
import mx.rastro.features.catalog.State;
import mx.rastro.features.dataset.DatasetService;
import mx.rastro.features.dataset.DatasetSnapshot;
import mx.rastro.features.records.PersonRecord;
import mx.rastro.features.records.RecordStatus;
import mx.rastro.shared.config.RastroProperties;
import mx.rastro.shared.error.ApiException;
import mx.rastro.shared.text.TextNormalizer;
import mx.rastro.shared.util.ApproximateLocation;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.function.Predicate;
import java.util.regex.Pattern;





@Service
public class SearchService {

    private static final Pattern SAFE_QUERY = Pattern.compile("^[\\p{L}\\p{M} .'\\-]+$");

    private final DatasetService datasetService;
    private final SearchIndex index;
    private final RastroProperties properties;

    public SearchService(DatasetService datasetService, SearchIndex index, RastroProperties properties) {
        this.datasetService = datasetService;
        this.index = index;
        this.properties = properties;
    }

    public SearchResponse search(String rawQuery, int limit, String estadoId, String estatus, Integer anio) {
        return search(rawQuery, limit, 0, estadoId, estatus, anio);
    }

    public SearchResponse search(String rawQuery, int limit, int offset, String estadoId, String estatus,
                                 Integer anio) {
        if (rawQuery == null || rawQuery.isBlank()) {
            throw ApiException.badRequest("consulta_vacia", "Escribe un nombre para buscar.");
        }
        String trimmed = rawQuery.strip();
        if (trimmed.length() > properties.getSearchMaxChars()) {
            throw ApiException.badRequest("consulta_larga",
                    "La búsqueda admite como máximo " + properties.getSearchMaxChars() + " caracteres.");
        }
        if (!SAFE_QUERY.matcher(trimmed).matches()) {
            throw ApiException.badRequest("consulta_invalida",
                    "La búsqueda sólo admite letras, espacios, puntos, guiones y apóstrofos.");
        }
        String normalized = TextNormalizer.normalize(trimmed);
        if (normalized.length() < properties.getSearchMinChars()) {
            throw ApiException.badRequest("consulta_corta",
                    "Escribe al menos " + properties.getSearchMinChars() + " letras del nombre.");
        }

        DatasetSnapshot dataset = datasetService.snapshot();
        if (!dataset.nombresDisponibles()) {
            throw ApiException.badRequest("busqueda_no_disponible",
                    "La base pública abierta es anonimizada y no incluye nombres. Carga un CSV autorizado "
                            + "con nombres para habilitar la búsqueda, o consulta por municipio en el mapa.");
        }
        Catalog catalog = dataset.catalog();
        if (estadoId != null && !estadoId.isBlank()) {
            if (!estadoId.matches("\\d{2}") || catalog.state(estadoId) == null) {
                throw ApiException.badRequest("estado_invalido", "La entidad indicada no existe.");
            }
        }
        if (anio != null && (anio < 1900 || anio > 2100)) {
            throw ApiException.badRequest("anio_invalido", "El año indicado no es válido.");
        }
        if (estatus != null && !estatus.isBlank()
                && !List.of("localizada", "desaparecida", "no_localizada").contains(estatus.toLowerCase(Locale.ROOT))) {
            throw ApiException.badRequest("estatus_invalido", "La situación indicada no es válida.");
        }

        Predicate<PersonRecord> filter = record -> {
            if (estadoId != null && !estadoId.isBlank()) {
                String recordState = record.estadoId();
                if (recordState == null && record.municipioId() != null) {
                    Municipality municipality = catalog.municipality(record.municipioId());
                    recordState = municipality == null ? null : municipality.estadoId();
                }
                if (!estadoId.equals(recordState)) {
                    return false;
                }
            }
            if (estatus != null && !estatus.isBlank()) {
                String value = estatus.toLowerCase(Locale.ROOT);
                if ("localizada".equals(value) && record.estatus() != RecordStatus.LOCALIZADA) {
                    return false;
                }
                if ("no_localizada".equals(value) && record.estatus() != RecordStatus.NO_LOCALIZADA) {
                    return false;
                }
                if ("desaparecida".equals(value) && record.estatus() != RecordStatus.DESAPARECIDA) {
                    return false;
                }
                if ("confidencial".equals(value) && record.estatus() != RecordStatus.CONFIDENCIAL) {
                    return false;
                }
            }
            if (anio != null && (record.fechaVisto() == null || record.fechaVisto().getYear() != anio)) {
                return false;
            }
            return true;
        };

        int cappedLimit = Math.max(1, Math.min(limit, properties.getSearchMaxResults()));
        long start = System.nanoTime();
        SearchIndex.SearchResult result = index.search(dataset, normalized, cappedLimit,
                Math.max(0, offset), filter);
        List<SearchHit> hits = new ArrayList<>(result.hits().size());
        for (SearchIndex.ScoredRecord scored : result.hits()) {
            hits.add(toHit(scored, catalog, dataset.synthetic(), normalized));
        }
        long millis = (System.nanoTime() - start) / 1_000_000;
        return new SearchResponse(trimmed, normalized, result.matched(), hits.size(), millis,
                dataset.synthetic(), List.copyOf(hits));
    }

    private SearchHit toHit(SearchIndex.ScoredRecord scored, Catalog catalog, boolean datasetSynthetic,
                            String normalizedQuery) {
        PersonRecord record = scored.record();
        Municipality municipality = record.municipioId() == null ? null : catalog.municipality(record.municipioId());
        State state = record.estadoId() == null ? null : catalog.state(record.estadoId());
        if (state == null && municipality != null) {
            state = catalog.stateOf(municipality);
        }
        String label = record.estatus().label();
        String quality = record.nombreNormalizado().equals(normalizedQuery) ? "Exacta"
                : scored.score() >= 0.9 ? "Alta"
                : scored.score() >= 0.78 ? "Aproximada" : "Baja";
        double lat = 0;
        double lon = 0;
        String precision = "sin_ubicacion";
        if (municipality != null) {
            double[] approximate = ApproximateLocation.around(record.id(), municipality.lat(), municipality.lon());
            lat = approximate[0];
            lon = approximate[1];
            precision = "municipio";
        } else if (state != null) {
            double[] approximate = ApproximateLocation.around(record.id(), state.lat(), state.lon());
            lat = approximate[0];
            lon = approximate[1];
            precision = "estado";
        }
        return new SearchHit(
                record.id(),
                record.nombre(),
                record.edad(),
                record.sexo(),
                record.fechaVisto(),
                record.estatus().name(),
                label,
                record.condicion(),
                record.municipioId() == null ? "" : record.municipioId(),
                municipality == null ? "Sin municipio público" : municipality.nombre(),
                record.estadoId() == null ? "" : record.estadoId(),
                state == null ? "Entidad no disponible" : state.nombre(),
                lat,
                lon,
                record.fuente(),
                datasetSynthetic || record.sintetico(),
                record.folio(),
                Math.round(scored.score() * 1000.0) / 1000.0,
                quality,
                precision);
    }
}
