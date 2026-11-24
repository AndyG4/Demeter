package mx.rastro.shared.text;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;







public final class TextNormalizer {

    private TextNormalizer() {
    }

    public static String normalize(String value) {
        if (value == null) {
            return "";
        }
        String decomposed = Normalizer.normalize(value, Normalizer.Form.NFD);
        StringBuilder sb = new StringBuilder(decomposed.length());
        for (int i = 0; i < decomposed.length(); i++) {
            char c = decomposed.charAt(i);
            if (Character.getType(c) == Character.NON_SPACING_MARK) {
                continue;
            }
            char lower = Character.toLowerCase(c);
            if (lower == 'ñ') {
                sb.append('n');
            } else if ((lower >= 'a' && lower <= 'z') || (lower >= '0' && lower <= '9')) {
                sb.append(lower);
            } else {
                sb.append(' ');
            }
        }
        String collapsed = sb.toString().replaceAll("\\s+", " ").trim();
        return collapsed.toLowerCase(Locale.ROOT);
    }

    public static List<String> tokens(String value) {
        String normalized = normalize(value);
        if (normalized.isEmpty()) {
            return List.of();
        }
        List<String> tokens = new ArrayList<>();
        for (String token : normalized.split(" ")) {
            if (!token.isBlank()) {
                tokens.add(token);
            }
        }
        return List.copyOf(tokens);
    }

    
    public static int length(String value) {
        return normalize(value).length();
    }
}
