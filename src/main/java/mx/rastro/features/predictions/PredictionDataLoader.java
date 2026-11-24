package mx.rastro.features.predictions;

import mx.rastro.shared.config.RastroProperties;
import mx.rastro.shared.util.Csv;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;





@Component
public class PredictionDataLoader {

    public static final String FOSAS_FILE = "fosas_estados_2006_2016.csv";
    public static final String PRESENCE_FILE = "presencia_municipal.csv";

    private final ResourceLoader resourceLoader;
    private final RastroProperties properties;

    public PredictionDataLoader(ResourceLoader resourceLoader, RastroProperties properties) {
        this.resourceLoader = resourceLoader;
        this.properties = properties;
    }

    public PredictionData load() {
        Map<String, Integer> stateFosas = new HashMap<>();
        Map<String, Map<Integer, Integer>> byYear = new HashMap<>();
        Map<String, Integer> presence = new HashMap<>();
        try {
            for (String[] row : rows(FOSAS_FILE, 2_000)) {
                String state = row[0].trim();
                int year = parseInt(row[1]);
                int fosas = parseInt(row[2]);
                if (state.isEmpty() || year < 1900 || fosas < 0) {
                    continue;
                }
                stateFosas.merge(state, fosas, Integer::sum);
                byYear.computeIfAbsent(state, ignored -> new HashMap<>()).merge(year, fosas, Integer::sum);
            }
            for (String[] row : rows(PRESENCE_FILE, 5_000)) {
                String id = row[0].trim();
                int value = parseInt(row[1]);
                if (id.matches("\\d{5}")) {
                    presence.put(id, value == 1 ? 1 : 0);
                }
            }
        } catch (IOException ex) {
            throw new IllegalStateException("No fue posible cargar los agregados históricos", ex);
        }
        return new PredictionData(Map.copyOf(stateFosas), Map.copyOf(byYear), Map.copyOf(presence));
    }

    private List<String[]> rows(String name, int maxRows) throws IOException {
        Path base = Path.of(properties.getDataDir()).toAbsolutePath().normalize();
        Path external = base.resolve(name).normalize();
        try (InputStreamReader reader = external.startsWith(base) && Files.isRegularFile(external)
                ? new InputStreamReader(Files.newInputStream(external), StandardCharsets.UTF_8)
                : new InputStreamReader(resourceLoader.getResource("classpath:data/" + name).getInputStream(),
                StandardCharsets.UTF_8)) {
            List<String[]> all = Csv.read(reader, maxRows + 1);
            return all.size() <= 1 ? List.of() : all.subList(1, all.size());
        }
    }

    private static int parseInt(String value) {
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException ex) {
            return -1;
        }
    }
}
