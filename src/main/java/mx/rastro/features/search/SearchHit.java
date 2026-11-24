package mx.rastro.features.search;

import java.time.LocalDate;

public record SearchHit(
        String id,
        String nombre,
        Integer edad,
        String sexo,
        LocalDate fechaVisto,
        String estatus,
        String estatusEtiqueta,
        String condicion,
        String municipioId,
        String municipio,
        String estadoId,
        String estado,
        double lat,
        double lon,
        String fuente,
        boolean sintetico,
        String folio,
        double score,
        String coincidencia,
        String precisionUbicacion) {
}
