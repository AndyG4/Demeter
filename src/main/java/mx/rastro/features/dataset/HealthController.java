package mx.rastro.features.dataset;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@RestController
@RequestMapping("/api/v1")
public class HealthController {

    private final DatasetService datasetService;

    public HealthController(DatasetService datasetService) {
        this.datasetService = datasetService;
    }

    @GetMapping("/health")
    public Health health() {
        DatasetSnapshot snapshot = datasetService.snapshot();
        return new Health("ok", snapshot.version(), snapshot.records().size(), Instant.now());
    }

    public record Health(String status, String datasetVersion, int records, Instant now) {
    }
}
