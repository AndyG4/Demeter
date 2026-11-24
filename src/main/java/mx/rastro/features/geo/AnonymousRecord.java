package mx.rastro.features.geo;

import java.time.LocalDate;


public record AnonymousRecord(
        String id,
        String folio,
        String sexo,
        Integer edad,
        LocalDate fecha,
        String estatus,
        String estatusEtiqueta,
        String fuente,
        String origenReporte) {
}
