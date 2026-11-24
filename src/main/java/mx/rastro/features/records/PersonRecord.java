package mx.rastro.features.records;

import java.time.LocalDate;









public record PersonRecord(
        String id,
        String folio,
        String nombre,
        String nombreNormalizado,
        Integer edad,
        String sexo,
        LocalDate fechaVisto,
        String municipioId,
        String estadoId,
        RecordStatus estatus,
        String condicion,
        String fuente,
        String origenReporte,
        boolean sintetico,
        boolean anonimizado,
        Double latitud,
        Double longitud,
        LocalDate actualizado) {
}
