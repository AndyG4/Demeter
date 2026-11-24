package mx.rastro.features.records;

import mx.rastro.features.catalog.Catalog;
import mx.rastro.features.catalog.Municipality;
import mx.rastro.shared.text.TextNormalizer;
import mx.rastro.shared.util.Csv;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;









@Component
public class RecordsLoader {

    private static final int MAX_RECORDS = 200_000;

    public LoadedRecords load(Path file, Catalog catalog, String sourceLabel, boolean synthetic, LocalDate cutoff)
            throws IOException {
        return load(file, catalog, sourceLabel, synthetic, cutoff, true);
    }

    public LoadedRecords load(Path file, Catalog catalog, String sourceLabel, boolean synthetic, LocalDate cutoff,
                              boolean requireDate) throws IOException {
        return load(file, catalog, sourceLabel, synthetic, cutoff, requireDate, true);
    }

    public LoadedRecords load(Path file, Catalog catalog, String sourceLabel, boolean synthetic, LocalDate cutoff,
                              boolean requireDate, boolean requireLocation) throws IOException {
        try (InputStream input = Files.newInputStream(file)) {
            return load(input, catalog, sourceLabel, synthetic, cutoff, requireDate, requireLocation);
        }
    }

    public LoadedRecords load(InputStream input, Catalog catalog, String sourceLabel, boolean synthetic,
                              LocalDate cutoff) throws IOException {
        return load(input, catalog, sourceLabel, synthetic, cutoff, true, true);
    }

    public LoadedRecords load(InputStream input, Catalog catalog, String sourceLabel, boolean synthetic,
                              LocalDate cutoff, boolean requireDate) throws IOException {
        return load(input, catalog, sourceLabel, synthetic, cutoff, requireDate, true);
    }

    public LoadedRecords load(InputStream input, Catalog catalog, String sourceLabel, boolean synthetic,
                              LocalDate cutoff, boolean requireDate, boolean requireLocation) throws IOException {
        List<PersonRecord> records = new ArrayList<>();
        Set<String> ids = new HashSet<>();
        try (InputStreamReader reader = new InputStreamReader(input, StandardCharsets.UTF_8)) {
            List<String[]> rows = Csv.read(reader, MAX_RECORDS + 1);
            if (rows.isEmpty()) {
                throw new IOException("CSV vacío");
            }
            Map<String, Integer> columns = new HashMap<>();
            String[] header = rows.getFirst();
            for (int i = 0; i < header.length; i++) {
                columns.put(headerKey(header[i]), i);
            }
            boolean hasName = find(columns, "nombre", "nombre_completo", "nombres", "nombre_s") != null
                    || find(columns, "apellido_paterno", "apellido_materno", "primer_apellido") != null;
            boolean hasAnonFlag = find(columns, "anonimizado") != null;
            if (!hasName && !hasAnonFlag) {
                throw new IOException("Falta una columna de nombre o la marca anonimizado");
            }
            if (find(columns, "estatus", "situacion", "estado_situacion") == null) {
                
            }
            if (find(columns, "municipio_id", "cve_mun", "clave_municipio", "id_municipio") == null
                    && find(columns, "municipio", "nom_mun", "nombre_municipio") == null
                    && find(columns, "estado_id", "estado", "entidad", "nom_ent", "entidad_federativa",
                            "entidad_de_desaparicion", "estado_de_desaparicion") == null) {
                throw new IOException("Falta una columna de municipio o entidad");
            }

            for (int r = 1; r < rows.size(); r++) {
                String[] row = rows.get(r);
                boolean anonymous = parseBoolean(value(row, columns, "anonimizado"));
                String nombre = fullName(row, columns);
                if (nombre.isBlank() && anonymous) {
                    nombre = "Persona anonimizada";
                }
                String normalized = anonymous ? "" : TextNormalizer.normalize(nombre);
                if (!anonymous && (normalized.length() < 3 || normalized.length() > 120)) {
                    continue;
                }

                Municipality municipality = resolveMunicipality(row, columns, catalog);
                String estadoId = resolveStateId(row, columns, catalog, municipality);
                if (municipality == null && estadoId == null && !anonymous && requireLocation) {
                    continue;
                }
                LocalDate fecha = parseDate(value(row, columns, "fecha_visto", "fecha_desaparicion",
                        "fecha_de_desaparicion", "fecha_hechos", "fecha"));
                if (fecha == null && !anonymous && requireDate) {
                    continue;
                }
                if (fecha != null && (fecha.isAfter(LocalDate.now().plusDays(1)) || fecha.getYear() < 1900)) {
                    continue;
                }

                String id = value(row, columns, "id", "id_registro", "clave_registro");
                if (id.isBlank()) {
                    id = "R" + String.format("%07d", r);
                }
                if (!ids.add(id)) {
                    continue;
                }
                String rawStatus = value(row, columns, "estatus", "situacion", "estado_situacion");
                String rawSex = value(row, columns, "sexo", "genero");
                if (TextNormalizer.normalize(rawSex).startsWith("eliminado")) {
                    continue;
                }
                Double lat = coordinate(value(row, columns, "latitud", "lat"), -90, 90);
                Double lon = coordinate(value(row, columns, "longitud", "lon", "lng"), -180, 180);
                if (lat == null || lon == null || lat < 14 || lat > 33 || lon < -119 || lon > -86) {
                    lat = null;
                    lon = null;
                }

                records.add(new PersonRecord(
                        id,
                        value(row, columns, "folio", "expediente", "numero_expediente"),
                        nombre,
                        normalized,
                        parseAge(value(row, columns, "edad")),
                        sex(value(row, columns, "sexo", "genero")),                        fecha,
                        municipality == null ? null : municipality.id(),
                        estadoId,
                        RecordStatus.from(rawStatus),
                        blankToNull(value(row, columns, "condicion", "condicion_localizacion")),
                        blankTo(value(row, columns, "fuente", "source"), sourceLabel),
                        blankToNull(value(row, columns, "origen_reporte", "autoridad", "autoridad_reportante",
                                "autoridad_que_reporto")),
                        synthetic,
                        anonymous,
                        lat,
                        lon,
                        parseDate(value(row, columns, "actualizado", "fecha_actualizacion"))));
            }
        }
        if (records.isEmpty()) {
            throw new IOException("El archivo no contiene registros válidos. Revisa municipio/entidad, fecha y nombre.");
        }
        return new LoadedRecords(List.copyOf(records), sourceLabel, synthetic, cutoff);
    }

    private Municipality resolveMunicipality(String[] row, Map<String, Integer> columns, Catalog catalog) {
        String id = value(row, columns, "municipio_id", "cve_mun", "clave_municipio", "id_municipio");
        if (!id.isBlank()) {
            Municipality byId = catalog.municipality(id);
            if (byId != null) {
                return byId;
            }
        }
        String name = value(row, columns, "municipio", "nom_mun", "nombre_municipio");
        String state = value(row, columns, "estado", "entidad", "nom_ent", "entidad_federativa",
                "entidad_de_desaparicion", "estado_de_desaparicion");
        if (name.matches("\\d{5}")) {
            Municipality byNumericName = catalog.municipality(name);
            if (byNumericName != null) {
                return byNumericName;
            }
        }
        if (name.isBlank() && id.matches("\\d{5}")) {
            return catalog.municipality(id);
        }
        if (name.isBlank()) {
            return null;
        }
        return catalog.municipalityByName(state, name);
    }

    private String resolveStateId(String[] row, Map<String, Integer> columns, Catalog catalog,
                                  Municipality municipality) {
        if (municipality != null) {
            return municipality.estadoId();
        }
        String raw = value(row, columns, "estado_id", "cve_ent", "clave_entidad");
        if (raw.matches("\\d{1,2}")) {
            String normalized = String.format("%02d", Integer.parseInt(raw));
            if (catalog.state(normalized) != null) {
                return normalized;
            }
        }
        String name = value(row, columns, "estado", "entidad", "nom_ent", "entidad_federativa",
                "entidad_de_desaparicion", "estado_de_desaparicion");
        return catalog.stateIdByName(name);
    }

    private String fullName(String[] row, Map<String, Integer> columns) {
        String complete = value(row, columns, "nombre_completo");
        if (!complete.isBlank()) {
            return complete;
        }
        String given = value(row, columns, "nombre", "nombres", "nombre_s", "nombres_persona");
        String paternal = value(row, columns, "apellido_paterno", "primer_apellido");
        String maternal = value(row, columns, "apellido_materno", "segundo_apellido");
        return String.join(" ", given, paternal, maternal).replaceAll("\\s+", " ").trim();
    }

    private static String headerKey(String header) {
        return TextNormalizer.normalize(header).replace(' ', '_');
    }

    private static Integer find(Map<String, Integer> columns, String... names) {
        for (String name : names) {
            Integer index = columns.get(headerKey(name));
            if (index != null) {
                return index;
            }
        }
        return null;
    }

    private static String value(String[] row, Map<String, Integer> columns, String... names) {
        Integer index = find(columns, names);
        return index == null || index >= row.length ? "" : row[index].trim();
    }

    private static String blankTo(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static boolean parseBoolean(String value) {
        String normalized = TextNormalizer.normalize(value);
        return "1".equals(normalized) || "true".equals(normalized) || "si".equals(normalized)
                || "yes".equals(normalized);
    }

    private static String sex(String value) {
        String normalized = TextNormalizer.normalize(value);
        if (normalized.startsWith("muj") || normalized.equals("f") || normalized.equals("femenino")) {
            return "Mujer";
        }
        if (normalized.startsWith("hom") || normalized.equals("m") || normalized.equals("masculino")) {
            return "Hombre";
        }
        if (normalized.startsWith("confidencial")) {
            return "Confidencial";
        }
        return "No especificado";
    }

    private static Integer parseAge(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("(\\d{1,3})").matcher(value);
        if (!matcher.find()) {
            return null;
        }
        int age = Integer.parseInt(matcher.group(1));
        return age >= 0 && age <= 120 ? age : null;
    }

    private static Double coordinate(String value, double min, double max) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            double parsed = Double.parseDouble(value.replace(',', '.'));
            return parsed >= min && parsed <= max ? parsed : null;
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static LocalDate parseDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();
        for (DateTimeFormatter formatter : List.of(
                DateTimeFormatter.ISO_LOCAL_DATE,
                DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"),
                DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss"),
                DateTimeFormatter.ofPattern("dd/MM/yyyy"),
                DateTimeFormatter.ofPattern("dd-MM-yyyy"),
                DateTimeFormatter.ofPattern("yyyy/MM/dd"))) {
            try {
                return LocalDate.parse(trimmed, formatter);
            } catch (DateTimeParseException ignored) {
                
            }
        }
        return null;
    }
}
