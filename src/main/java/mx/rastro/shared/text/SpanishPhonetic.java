package mx.rastro.shared.text;

import java.util.Locale;





public final class SpanishPhonetic {

    private SpanishPhonetic() {
    }

    public static String key(String token) {
        String n = TextNormalizer.normalize(token).replace(" ", "");
        if (n.isEmpty()) {
            return "";
        }
        StringBuilder prepared = new StringBuilder(n.length());
        for (int i = 0; i < n.length(); i++) {
            char c = n.charAt(i);
            char next = i + 1 < n.length() ? n.charAt(i + 1) : '\0';
            if (c == 'h') {
                continue;
            }
            if (c == 'c' && next == 'h') {
                prepared.append('x');
                i++;
                continue;
            }
            if (c == 'l' && next == 'l') {
                prepared.append('y');
                i++;
                continue;
            }
            if (c == 'r' && next == 'r') {
                prepared.append('r');
                i++;
                continue;
            }
            if (c == 'q' && next == 'u') {
                prepared.append('k');
                i++;
                continue;
            }
            if (c == 'g' && next == 'u' && i + 2 < n.length()
                    && "ei".indexOf(n.charAt(i + 2)) >= 0) {
                prepared.append('g');
                i++;
                continue;
            }
            prepared.append(c);
        }

        String s = prepared.toString();
        StringBuilder out = new StringBuilder(5);
        out.append(Character.toUpperCase(s.charAt(0)));
        char lastDigit = '\0';
        for (int i = 1; i < s.length() && out.length() < 5; i++) {
            char c = s.charAt(i);
            char digit = switch (c) {
                case 'b', 'v', 'f', 'p' -> '1';
                case 'c', 's', 'z', 'x' -> '2';
                case 'd', 't' -> '3';
                case 'l' -> '4';
                case 'm', 'n' -> '5';
                case 'r' -> '6';
                case 'g', 'j', 'k', 'q' -> '7';
                default -> '0';
            };
            if (digit != '0' && digit != lastDigit) {
                out.append(digit);
                lastDigit = digit;
            }
        }
        while (out.length() < 4) {
            out.append('0');
        }
        return out.toString().toUpperCase(Locale.ROOT);
    }
}
