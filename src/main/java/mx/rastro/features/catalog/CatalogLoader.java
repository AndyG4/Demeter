package mx.rastro.features.catalog;

import mx.rastro.shared.util.Csv;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;


@Component
public class CatalogLoader {

    private final ResourceLoader resourceLoader;

    public CatalogLoader(ResourceLoader resourceLoader) {
        this.resourceLoader = resourceLoader;
    }

    public Catalog load() {
        List<State> states = new ArrayList<>();
        List<Municipality> municipalities = new ArrayList<>();
        try {
            for (String[] row : rows("classpath:data/estados.csv", 100)) {
                states.add(new State(
                        row[0].trim(),
                        row[1].trim(),
                        parseDouble(row[2]),
                        parseDouble(row[3]),
                        parseInt(row[4]),
                        parseInt(row[5])));
            }
            for (String[] row : rows("classpath:data/municipios.csv", 5_000)) {
                municipalities.add(new Municipality(
                        row[0].trim(),
                        row[1].trim(),
                        row[2].trim(),
                        parseDouble(row[3]),
                        parseDouble(row[4]),
                        parseInt(row[5]),
                        row.length > 6 ? row[6].trim() : "municipio"));
            }
        } catch (IOException ex) {
            throw new IllegalStateException("No fue posible cargar el catálogo", ex);
        }
        if (states.size() != 32) {
            throw new IllegalStateException("Catálogo de entidades incompleto: " + states.size());
        }
        if (municipalities.size() < 2_400) {
            throw new IllegalStateException("Catálogo municipal incompleto: " + municipalities.size());
        }
        return new Catalog(states, municipalities);
    }

    private List<String[]> rows(String location, int maxRows) throws IOException {
        Resource resource = resourceLoader.getResource(location);
        try (InputStreamReader reader = new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8)) {
            List<String[]> all = Csv.read(reader, maxRows);
            if (all.isEmpty()) {
                return List.of();
            }
            Map<String, Integer> index = new HashMap<>();
            String[] header = all.getFirst();
            for (int i = 0; i < header.length; i++) {
                index.put(header[i].trim(), i);
            }
            List<String[]> result = new ArrayList<>();
            for (int r = 1; r < all.size(); r++) {
                String[] raw = all.get(r);
                String[] mapped = new String[index.size()];
                for (Map.Entry<String, Integer> entry : index.entrySet()) {
                    int source = entry.getValue();
                    mapped[source] = source < raw.length ? raw[source] : "";
                }
                result.add(mapped);
            }
            return result;
        }
    }

    private static double parseDouble(String value) {
        try {
            double parsed = Double.parseDouble(value.trim());
            return Double.isFinite(parsed) ? parsed : 0.0;
        } catch (NumberFormatException ex) {
            return 0.0;
        }
    }

    private static int parseInt(String value) {
        try {
            return Math.max(0, Integer.parseInt(value.trim()));
        } catch (NumberFormatException ex) {
            return 0;
        }
    }
}
