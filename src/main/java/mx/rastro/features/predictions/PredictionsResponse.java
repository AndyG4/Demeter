package mx.rastro.features.predictions;

import java.util.List;

public record PredictionsResponse(
        String modelo,
        String objetivo,
        String advertencia,
        String versionDatos,
        int celdas,
        List<PredictionCell> resultados) {
}
