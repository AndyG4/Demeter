package mx.rastro.features.predictions;

import java.util.List;

public record PredictionCell(
        String municipioId,
        String municipio,
        String estadoId,
        String estado,
        double lat,
        double lon,
        int poblacion,
        int presenciaDocumentada,
        double fosasEsperadas,
        double indice,
        double probabilidadRf,
        double kde,
        double prioridad,
        String banda,
        int cluster,
        String clusterNombre,
        int comunidad,
        List<String> factores) {
}
