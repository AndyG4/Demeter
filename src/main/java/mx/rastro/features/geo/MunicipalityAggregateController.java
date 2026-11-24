package mx.rastro.features.geo;

import mx.rastro.shared.error.ApiException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping(path = "/api/v1/geo")
public class MunicipalityAggregateController {

    private final MunicipalityAggregateService service;

    public MunicipalityAggregateController(MunicipalityAggregateService service) {
        this.service = service;
    }

    @GetMapping("/municipios")
    public List<MunicipalityAggregate> municipalities(
            @RequestParam(name = "estado", required = false) String estado) {
        if (estado != null && !estado.isBlank() && !estado.matches("\\d{2}")) {
            throw ApiException.badRequest("estado_invalido", "La entidad indicada no es válida.");
        }
        return service.byState(estado);
    }
}
