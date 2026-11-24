package mx.rastro.features.predictions;

import java.util.Map;

public record PredictionData(
        Map<String, Integer> stateFosas,
        Map<String, Map<Integer, Integer>> fosasByStateYear,
        Map<String, Integer> presence) {
}
