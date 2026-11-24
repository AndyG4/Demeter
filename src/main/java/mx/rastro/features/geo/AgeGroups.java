package mx.rastro.features.geo;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;


public final class AgeGroups {

    public static final List<String> KEYS = List.of("0-11", "12-17", "18-29", "30-44", "45-59", "60+", "Sin dato");

    private AgeGroups() {
    }

    public static int index(Integer age) {
        if (age == null || age < 0) {
            return 6;
        }
        if (age <= 11) {
            return 0;
        }
        if (age <= 17) {
            return 1;
        }
        if (age <= 29) {
            return 2;
        }
        if (age <= 44) {
            return 3;
        }
        if (age <= 59) {
            return 4;
        }
        return 5;
    }

    public static Map<String, Integer> toMap(int[] counts) {
        Map<String, Integer> result = new LinkedHashMap<>();
        for (int i = 0; i < KEYS.size(); i++) {
            result.put(KEYS.get(i), counts[i]);
        }
        return result;
    }
}
