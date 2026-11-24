package mx.rastro.features.catalog;

public record State(
        String id,
        String nombre,
        double lat,
        double lon,
        int poblacion,
        int municipios) {
}
