package mx.rastro.features.dataset;

import mx.rastro.features.catalog.Catalog;
import mx.rastro.features.records.PersonRecord;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record DatasetSnapshot(
        String version,
        Catalog catalog,
        List<PersonRecord> records,
        List<PersonRecord> searchRecords,
        String sourceLabel,
        boolean synthetic,
        boolean nombresDisponibles,
        LocalDate cutoff,
        Instant loadedAt) {
}
