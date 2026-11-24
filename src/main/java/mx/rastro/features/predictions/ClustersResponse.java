package mx.rastro.features.predictions;

import java.util.List;

public record ClustersResponse(
        String metodo,
        String advertencia,
        List<ClusterInfo> clusters,
        List<CommunityInfo> comunidades) {

    public record ClusterInfo(
            int id,
            String nombre,
            String descripcion,
            int municipios,
            long poblacion,
            double tasaFosas,
            List<String> estados) {
    }

    public record CommunityInfo(
            int id,
            int municipios,
            double lat,
            double lon,
            List<String> estados) {
    }
}
