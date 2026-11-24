package mx.rastro.features.geo;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/v1/geo")
public class GeoController {

    private static final MediaType GEO_JSON = MediaType.valueOf("application/geo+json");

    private final GeoJsonService geoJsonService;

    public GeoController(GeoJsonService geoJsonService) {
        this.geoJsonService = geoJsonService;
    }

    @GetMapping(value = "/estados", produces = {"application/geo+json", "application/json"})
    public ResponseEntity<byte[]> estados(
            @RequestHeader(name = "If-None-Match", required = false) String ifNoneMatch) {
        GeoJsonService.Cached cached = geoJsonService.geoJson();
        if (ifNoneMatch != null && ifNoneMatch.equals(cached.etag())) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED)
                    .eTag(cached.etag())
                    .cacheControl(CacheControl.maxAge(5, TimeUnit.MINUTES).cachePublic())
                    .build();
        }
        return ResponseEntity.ok()
                .contentType(GEO_JSON)
                .eTag(cached.etag())
                .cacheControl(CacheControl.maxAge(5, TimeUnit.MINUTES).cachePublic())
                .body(cached.bytes());
    }
}
