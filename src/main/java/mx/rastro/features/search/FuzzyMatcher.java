package mx.rastro.features.search;

import mx.rastro.shared.text.DamerauLevenshtein;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;








public final class FuzzyMatcher {

    private static final Map<String, String> NICKNAMES = Map.ofEntries(
            Map.entry("pancho", "francisco"), Map.entry("paco", "francisco"),
            Map.entry("pepe", "jose"), Map.entry("chepe", "jose"),
            Map.entry("lupe", "guadalupe"), Map.entry("lupita", "guadalupe"),
            Map.entry("beto", "alberto"), Map.entry("lalo", "eduardo"),
            Map.entry("chuy", "jesus"), Map.entry("mari", "maria"),
            Map.entry("rosy", "rosa"), Map.entry("vero", "veronica"),
            Map.entry("cami", "camila"), Map.entry("fer", "fernanda"),
            Map.entry("ale", "alejandra"), Map.entry("gaby", "gabriela"),
            Map.entry("tono", "antonio"), Map.entry("toño", "antonio"),
            Map.entry("nacho", "ignacio"), Map.entry("rafa", "rafael"),
            Map.entry("richi", "ricardo"), Map.entry("sergio", "sergio"));

    private FuzzyMatcher() {
    }

    public static double score(List<String> queryTokens, List<String> recordTokens) {
        if (queryTokens.isEmpty() || recordTokens.isEmpty()) {
            return 0.0;
        }
        double weighted = 0.0;
        double weights = 0.0;
        int matched = 0;

        for (String query : queryTokens) {
            if (query.length() == 1) {
                continue;
            }
            double best = 0.0;
            int max = maxDistance(query.length());
            for (String candidate : recordTokens) {
                if (candidate.length() == 1) {
                    continue;
                }
                if (query.equals(candidate)) {
                    best = 1.0;
                    break;
                }
                int candidateMax = Math.min(max, maxDistance(candidate.length()));
                double similarity = DamerauLevenshtein.similarity(query, candidate, candidateMax);
                if (similarity > best) {
                    best = similarity;
                }
            }
            if (best >= 0.64) {
                matched++;
            }
            double weight = Math.min(8, Math.max(3, query.length()));
            weighted += best * weight;
            weights += weight;
        }

        if (weights == 0.0) {
            return 0.0;
        }
        double average = weighted / weights;
        double coverage = (double) matched / Math.max(1, queryTokens.size());
        if (coverage < 0.5) {
            return 0.0;
        }
        return 0.78 * average + 0.22 * coverage;
    }

    public static int maxDistance(int length) {
        if (length <= 4) {
            return 1;
        }
        if (length <= 8) {
            return 2;
        }
        return 3;
    }

    
    public static Set<String> variants(String token) {
        Set<String> variants = new LinkedHashSet<>();
        variants.add(token);
        String direct = NICKNAMES.get(token);
        if (direct != null) {
            variants.add(direct);
        }
        for (Map.Entry<String, String> entry : NICKNAMES.entrySet()) {
            if (entry.getValue().equals(token)) {
                variants.add(entry.getKey());
            }
        }
        return variants;
    }

    public static List<String> expand(List<String> tokens) {
        List<String> expanded = new ArrayList<>();
        for (String token : tokens) {
            expanded.addAll(variants(token));
        }
        return expanded;
    }
}
