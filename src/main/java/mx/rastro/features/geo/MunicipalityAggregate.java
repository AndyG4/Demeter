package mx.rastro.features.geo;

import java.util.Map;


public record MunicipalityAggregate(
        String municipioId,
        String municipio,
        String estadoId,
        String estado,
        double lat,
        double lon,
        int poblacion,
        int registros,
        int desaparecidas,
        int noLocalizadas,
        int localizadas,
        int confidenciales,
        double tasaPor100k,
        Map<String, Integer> gruposEdad) {
}
