package mx.rastro.features.dataset;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import mx.rastro.features.catalog.Catalog;
import mx.rastro.features.catalog.CatalogLoader;
import mx.rastro.features.records.DemoRecordsFactory;
import mx.rastro.features.records.LoadedRecords;
import mx.rastro.features.records.PersonRecord;
import mx.rastro.features.records.RecordsLoader;
import mx.rastro.shared.config.RastroProperties;
import mx.rastro.shared.error.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.zip.GZIPInputStream;






@Service
public class DatasetService {

    private static final Logger log = LoggerFactory.getLogger(DatasetService.class);

    private final RastroProperties properties;
    private final CatalogLoader catalogLoader;
    private final RecordsLoader recordsLoader;
    private final DemoRecordsFactory demoFactory;
    private final ObjectMapper objectMapper;
    private final ApplicationEventPublisher publisher;
    private final ResourceLoader resourceLoader;

    private volatile DatasetSnapshot snapshot;
    private volatile long loadedMtime;

    public DatasetService(
            RastroProperties properties,
            CatalogLoader catalogLoader,
            RecordsLoader recordsLoader,
            DemoRecordsFactory demoFactory,
            ObjectMapper objectMapper,
            ApplicationEventPublisher publisher,
            ResourceLoader resourceLoader) {
        this.properties = properties;
        this.catalogLoader = catalogLoader;
        this.recordsLoader = recordsLoader;
        this.demoFactory = demoFactory;
        this.objectMapper = objectMapper;
        this.publisher = publisher;
        this.resourceLoader = resourceLoader;
    }

    @PostConstruct
    public void init() {
        DatasetSnapshot loaded = load();
        this.snapshot = loaded;
        this.loadedMtime = currentMtime();
        log.info("Datos cargados: {} registros, sintético={}, fuente={}, versión={}",
                loaded.records().size(), loaded.synthetic(), loaded.sourceLabel(), loaded.version());
    }

    public DatasetSnapshot snapshot() {
        DatasetSnapshot current = snapshot;
        if (current == null) {
            throw ApiException.unavailable("datos_no_listos", "Los datos aún no están disponibles.");
        }
        return current;
    }

    @Scheduled(fixedDelayString = "${rastro.refresh-seconds:300}000", initialDelay = 60_000)
    public void refreshIfChanged() {
        if (!properties.isAutoRefresh()) {
            return;
        }
        long mtime = currentMtime();
        if (mtime > loadedMtime) {
            synchronized (this) {
                if (currentMtime() > loadedMtime) {
                    try {
                        DatasetSnapshot loaded = load();
                        this.snapshot = loaded;
                        this.loadedMtime = mtime;
                        publisher.publishEvent(new DatasetChangedEvent(loaded));
                        log.info("Datos recargados: {} registros, versión={}", loaded.records().size(), loaded.version());
                    } catch (RuntimeException ex) {
                        log.error("No fue posible recargar los datos; se conserva la versión anterior", ex);
                    }
                }
            }
        }
    }

    private DatasetSnapshot load() {
        Catalog catalog = catalogLoader.load();
        Path base = Path.of(properties.getDataDir()).toAbsolutePath().normalize();
        Path manifestPath = base.resolve("manifest.json").normalize();
        DatasetManifest manifest = readManifest(manifestPath);

        String recordsFile = manifest.recordsFile() == null || manifest.recordsFile().isBlank()
                ? "registros.csv"
                : manifest.recordsFile();
        if (recordsFile.contains("/") || recordsFile.contains("\\") || !recordsFile.endsWith(".csv")) {
            throw new IllegalStateException("recordsFile inválido en manifest.json");
        }
        Path file = base.resolve(recordsFile).normalize();
        if (!file.startsWith(base)) {
            throw new IllegalStateException("Ruta de registros fuera del directorio de datos");
        }

        LoadedRecords loaded;
        boolean synthetic;
        String source;
        String version;
        LocalDate cutoff;

        if (Files.isRegularFile(file)) {
            try {
                synthetic = Boolean.TRUE.equals(manifest.synthetic());
                source = manifest.source() == null || manifest.source().isBlank() ? "Archivo local" : manifest.source().trim();
                LocalDate manifestCutoff = manifest.cutoff();
                loaded = recordsLoader.load(file, catalog, source, synthetic, manifestCutoff);
                cutoff = manifestCutoff != null ? manifestCutoff : latestUpdate(loaded.records());
                version = (manifest.version() == null || manifest.version().isBlank()
                        ? "file"
                        : manifest.version().trim()) + "-" + shortHash(file);
            } catch (IOException ex) {
                throw new IllegalStateException("No fue posible leer " + file + ": " + ex.getMessage(), ex);
            }
        } else {
            boolean expectsFile = (manifest.recordsFile() != null && !manifest.recordsFile().isBlank())
                    || Boolean.FALSE.equals(manifest.synthetic());
            if (expectsFile) {
                throw new IllegalStateException("manifest.json declara datos reales pero no existe " + file);
            }
            Resource real = resourceLoader.getResource("classpath:data/registros_combinados.csv.gz");
            if (!real.exists()) {
                real = resourceLoader.getResource("classpath:data/registros_abril_2026.csv.gz");
            }
            if (!real.exists()) {
                real = resourceLoader.getResource("classpath:data/registros_reales.csv.gz");
            }
            if (real.exists()) {
                String filename = real.getFilename() == null ? "" : real.getFilename();
                boolean combined = filename.contains("combinados");
                boolean april2026 = filename.contains("abril_2026");
                try (InputStream input = new GZIPInputStream(real.getInputStream())) {
                    source = combined
                            ? "RNPDNO · base 2025 + abril 2026 (Data Cívica, anonimizada)"
                            : april2026
                                ? "RNPDNO · base filtrada abril 2026 (Data Cívica, anonimizada)"
                                : "RNPDNO · datos abiertos anonimizados (Codeando México / Data Cívica)";
                    LocalDate realCutoff = (combined || april2026)
                            ? LocalDate.of(2026, 4, 30)
                            : LocalDate.of(2025, 10, 2);
                    loaded = recordsLoader.load(input, catalog, source, false, realCutoff);
                    synthetic = false;
                    cutoff = realCutoff;
                    version = combined ? "combinado-2026" : april2026 ? "abril-2026" : "real-2025-10-02";
                } catch (IOException ex) {
                    throw new IllegalStateException("No fue posible leer la base real incluida: " + ex.getMessage(), ex);
                }
            } else {
                if (!properties.isDemoEnabled()) {
                    throw new IllegalStateException("No hay registros reales ni demostración disponible");
                }
                loaded = demoFactory.generate(catalog);
                synthetic = true;
                source = loaded.sourceLabel();
                cutoff = loaded.cutoff();
                version = "demo-2026-11";
            }
        }

        List<PersonRecord> ordered = loaded.records().stream()
                .sorted(Comparator.comparing(PersonRecord::fechaVisto,
                                Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(PersonRecord::id))
                .toList();
        List<PersonRecord> searchRecords = ordered;
        Path namesFile = base.resolve("registros_nombres.csv");
        if (Files.isRegularFile(namesFile)) {
            try {
                LoadedRecords named = recordsLoader.load(namesFile, catalog,
                        "Data Cívica / RNPDNO · nombres públicos", false, cutoff, false, false);
                searchRecords = named.records().stream()
                        .sorted(Comparator.comparing(PersonRecord::fechaVisto,
                                        Comparator.nullsLast(Comparator.reverseOrder()))
                                .thenComparing(PersonRecord::id))
                        .toList();
                version = version + "-n" + shortHash(namesFile);
            } catch (IOException ex) {
                throw new IllegalStateException("No fue posible leer " + namesFile + ": " + ex.getMessage(), ex);
            }
        }
        boolean nombresDisponibles = searchRecords.stream()
                .anyMatch(record -> !record.anonimizado() && !record.nombreNormalizado().isBlank());

        long evidenceMtime = mtimeOf(base, "fosas_estados_2006_2016.csv", "presencia_municipal.csv");
        if (evidenceMtime > 0) {
            version = version + "-g" + Long.toHexString(evidenceMtime);
        }

        log.info("Búsqueda por nombre: {} registros, disponibles={}", searchRecords.size(), nombresDisponibles);
        return new DatasetSnapshot(version, catalog, ordered, searchRecords, source, synthetic,
                nombresDisponibles, cutoff, Instant.now());
    }

    private DatasetManifest readManifest(Path path) {
        if (!Files.isRegularFile(path)) {
            return DatasetManifest.empty();
        }
        try {
            DatasetManifest manifest = objectMapper.readValue(path.toFile(), DatasetManifest.class);
            return manifest == null ? DatasetManifest.empty() : manifest;
        } catch (IOException ex) {
            throw new IllegalStateException("manifest.json inválido: " + ex.getMessage(), ex);
        }
    }

    private LocalDate latestUpdate(List<PersonRecord> records) {
        LocalDate latest = null;
        for (PersonRecord record : records) {
            if (record.actualizado() != null && (latest == null || record.actualizado().isAfter(latest))) {
                latest = record.actualizado();
            }
        }
        return latest == null ? LocalDate.now() : latest;
    }

    private long currentMtime() {
        Path base = Path.of(properties.getDataDir()).toAbsolutePath().normalize();
        return mtimeOf(base, "registros.csv", "manifest.json", "registros_nombres.csv",
                "fosas_estados_2006_2016.csv", "presencia_municipal.csv");
    }

    private long mtimeOf(Path base, String... names) {
        long max = 0;
        for (String name : names) {
            Path path = base.resolve(name);
            try {
                if (Files.isRegularFile(path)) {
                    FileTime time = Files.getLastModifiedTime(path);
                    max = Math.max(max, time.toMillis());
                }
            } catch (IOException ignored) {
                
            }
        }
        return max;
    }

    private String shortHash(Path file) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (var in = Files.newInputStream(file)) {
                byte[] buffer = new byte[16_384];
                int read;
                while ((read = in.read(buffer)) != -1) {
                    digest.update(buffer, 0, read);
                }
            }
            return HexFormat.of().formatHex(digest.digest(), 0, 6);
        } catch (Exception ex) {
            try {
                return Long.toHexString(Files.getLastModifiedTime(file).toMillis());
            } catch (IOException ignored) {
                return "desconocida";
            }
        }
    }
}
