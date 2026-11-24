package mx.rastro.features.search;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(path = "/api/v1/search", produces = MediaType.APPLICATION_JSON_VALUE)
public class SearchController {

    private final SearchService searchService;

    public SearchController(SearchService searchService) {
        this.searchService = searchService;
    }

    @GetMapping
    public SearchResponse search(
            @RequestParam("q") String query,
            @RequestParam(name = "limit", defaultValue = "25") int limit,
            @RequestParam(name = "offset", defaultValue = "0") int offset,
            @RequestParam(name = "estado", required = false) String estado,
            @RequestParam(name = "estatus", required = false) String estatus,
            @RequestParam(name = "anio", required = false) Integer anio) {
        return searchService.search(query, limit, offset, estado, estatus, anio);
    }
}
