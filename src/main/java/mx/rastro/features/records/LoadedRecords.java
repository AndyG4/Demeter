package mx.rastro.features.records;

import java.time.LocalDate;
import java.util.List;

public record LoadedRecords(
        List<PersonRecord> records,
        String sourceLabel,
        boolean synthetic,
        LocalDate cutoff) {
}
