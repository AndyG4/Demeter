package mx.rastro.features.catalog;

public record Municipality(
        String id,
        String nombre,
        String estadoId,
        double lat,
        double lon,
        int poblacion,
        String precision) {
}
