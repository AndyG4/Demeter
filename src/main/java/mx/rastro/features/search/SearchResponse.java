package mx.rastro.features.search;

import java.util.List;

public record SearchResponse(
        String consulta,
        String normalizada,
        int total,
        int mostrados,
        long ms,
        boolean sintetico,
        List<SearchHit> resultados) {
}
