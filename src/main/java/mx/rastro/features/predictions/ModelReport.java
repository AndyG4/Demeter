package mx.rastro.features.predictions;

import java.util.List;
import java.util.Map;

public record ModelReport(
        String objetivo,
        String versionDatos,
        String advertencia,
        String modeloSeleccionado,
        int municipios,
        int positivos,
        double prevalencia,
        List<ModelMetrics> modelos,
        List<FoldResult> folds,
        Map<String, Double> importancia,
        TemporalMetrics temporal) {

    public record ModelMetrics(
            String id,
            String nombre,
            String descripcion,
            boolean seleccionado,
            double auc,
            double ap,
            double precision10,
            double lift10,
            Double brier) {
    }

    public record FoldResult(
            int fold,
            int municipios,
            int positivos,
            double auc,
            double ap,
            double precision10,
            double lift10) {
    }

    public record TemporalMetrics(
            int estados,
            int predicciones,
            double mae,
            double rmse,
            double spearman,
            String nota) {
    }
}
