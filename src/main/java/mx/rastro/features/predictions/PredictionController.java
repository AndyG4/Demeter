package mx.rastro.features.predictions;

import mx.rastro.features.dataset.DatasetService;
import mx.rastro.shared.error.ApiException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping(path = "/api/v1", produces = "application/json")
public class PredictionController {

    private final PredictionService predictionService;
    private final DatasetService datasetService;
    private final ModelDiagnosticsService diagnosticsService;

    public PredictionController(PredictionService predictionService, DatasetService datasetService,
                                ModelDiagnosticsService diagnosticsService) {
        this.predictionService = predictionService;
        this.datasetService = datasetService;
        this.diagnosticsService = diagnosticsService;
    }

    @GetMapping("/predictions")
    public PredictionsResponse predictions(
            @RequestParam(name = "estado", required = false) String estado,
            @RequestParam(name = "limit", defaultValue = "0") int limit) {
        if (estado != null && !estado.isBlank()) {
            if (!estado.matches("\\d{2}") || datasetService.snapshot().catalog().state(estado) == null) {
                throw ApiException.badRequest("estado_invalido", "La entidad indicada no existe.");
            }
        }
        if (limit < 0 || limit > 2_500) {
            throw ApiException.badRequest("limite_invalido", "El límite debe estar entre 0 y 2500.");
        }
        ModelReport report = predictionService.report();
        List<PredictionCell> cells = predictionService.cells(estado, limit);
        return new PredictionsResponse(
                report.modeloSeleccionado(),
                report.objetivo(),
                report.advertencia(),
                report.versionDatos(),
                cells.size(),
                cells);
    }

    @GetMapping("/models")
    public ModelReport models() {
        return predictionService.report();
    }

    @GetMapping("/models/diagnostics")
    public ModelDiagnosticsService.Report diagnostics() {
        return diagnosticsService.evaluate();
    }

    @GetMapping("/clusters")
    public ClustersResponse clusters() {
        return predictionService.clusters();
    }
}
