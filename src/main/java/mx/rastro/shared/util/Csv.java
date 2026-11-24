package mx.rastro.shared.util;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.Reader;
import java.util.ArrayList;
import java.util.List;





public final class Csv {

    private static final int MAX_FIELD = 8_192;
    private static final int MAX_COLUMNS = 32;

    private Csv() {
    }

    public static List<String[]> read(Reader source, int maxRows) throws IOException {
        BufferedReader reader = source instanceof BufferedReader br ? br : new BufferedReader(source);
        List<String[]> rows = new ArrayList<>();
        List<String> row = new ArrayList<>();
        StringBuilder field = new StringBuilder();
        boolean quoted = false;
        boolean any = false;
        int c;
        int columns = 0;

        while ((c = reader.read()) != -1) {
            char ch = (char) c;
            if (ch == '\uFEFF' && field.isEmpty() && row.isEmpty()) {
                continue;
            }
            if (quoted) {
                if (ch == '"') {
                    reader.mark(1);
                    int next = reader.read();
                    if (next == '"') {
                        field.append('"');
                    } else {
                        quoted = false;
                        if (next != -1) {
                            reader.reset();
                        }
                    }
                } else {
                    field.append(ch);
                }
            } else {
                if (ch == '"' && field.isEmpty()) {
                    quoted = true;
                    any = true;
                } else if (ch == ',') {
                    row.add(field.toString());
                    field.setLength(0);
                    any = true;
                    if (row.size() > MAX_COLUMNS) {
                        throw new IOException("CSV con demasiadas columnas");
                    }
                } else if (ch == '\n' || ch == '\r') {
                    if (ch == '\r') {
                        reader.mark(1);
                        int next = reader.read();
                        if (next != '\n' && next != -1) {
                            reader.reset();
                        }
                    }
                    if (any || !field.isEmpty() || !row.isEmpty()) {
                        row.add(field.toString());
                        field.setLength(0);
                        rows.add(row.toArray(String[]::new));
                        row.clear();
                        any = false;
                        if (rows.size() > maxRows) {
                            throw new IOException("CSV con demasiadas filas");
                        }
                    }
                } else {
                    field.append(ch);
                    any = true;
                    if (field.length() > MAX_FIELD) {
                        throw new IOException("Campo CSV demasiado largo");
                    }
                }
            }
        }
        if (quoted) {
            throw new IOException("CSV con comillas sin cerrar");
        }
        if (any || !field.isEmpty() || !row.isEmpty()) {
            row.add(field.toString());
            rows.add(row.toArray(String[]::new));
        }
        return rows;
    }
}
