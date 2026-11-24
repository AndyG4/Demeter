package mx.rastro.features.geo;

import mx.rastro.features.catalog.Municipality;
import mx.rastro.features.dataset.DatasetService;
import mx.rastro.features.dataset.DatasetSnapshot;
import mx.rastro.features.records.PersonRecord;
import mx.rastro.features.records.RecordStatus;
import mx.rastro.shared.error.ApiException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Comparator;
import java.util.List;

@RestController
@RequestMapping(path = "/api/v1/geo")
public class MunicipalityRecordsController {

    private final DatasetService datasetService;

    public MunicipalityRecordsController(DatasetService datasetService) {
        this.datasetService = datasetService;
    }

    @GetMapping("/municipios/{municipioId}/registros")
    public List<AnonymousRecord> records(
            @PathVariable("municipioId") String municipioId,
            @RequestParam(name = "limit", defaultValue = "50") int limit,
            @RequestParam(name = "estatus", required = false) String estatus) {
        if (!municipioId.matches("\\d{5}")) {
            throw ApiException.badRequest("municipio_invalido", "La clave municipal no es válida.");
        }
        DatasetSnapshot dataset = datasetService.snapshot();
        Municipality municipality = dataset.catalog().municipality(municipioId);
        if (municipality == null) {
            throw ApiException.notFound("municipio_no_encontrado", "El municipio no existe en el catálogo.");
        }
        RecordStatus filter = estatus == null || estatus.isBlank() ? null : RecordStatus.from(estatus);
        int capped = Math.max(1, Math.min(100, limit));
        return dataset.records().stream()
                .filter(record -> municipioId.equals(record.municipioId()))
                .filter(record -> filter == null || record.estatus() == filter)
                .sorted(Comparator.comparing(PersonRecord::fechaVisto,
                                Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(PersonRecord::id))
                .limit(capped)
                .map(record -> new AnonymousRecord(
                        record.id(),
                        record.folio(),
                        record.sexo(),
                        record.edad(),
                        record.fechaVisto(),
                        record.estatus().name(),
                        record.estatus().label(),
                        record.fuente(),
                        record.origenReporte()))
                .toList();
    }
}
