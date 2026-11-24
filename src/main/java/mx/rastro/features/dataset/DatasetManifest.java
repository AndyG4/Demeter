package mx.rastro.features.dataset;

import java.time.LocalDate;


public record DatasetManifest(
        String version,
        LocalDate cutoff,
        String source,
        Boolean synthetic,
        String recordsFile) {

    public static DatasetManifest empty() {
        return new DatasetManifest(null, null, null, null, null);
    }
}
