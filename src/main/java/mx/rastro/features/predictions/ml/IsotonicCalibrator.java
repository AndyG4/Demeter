package mx.rastro.features.predictions.ml;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;








public final class IsotonicCalibrator {

    private final double[] thresholds;
    private final double[] values;

    private IsotonicCalibrator(double[] thresholds, double[] values) {
        this.thresholds = thresholds;
        this.values = values;
    }

    public static IsotonicCalibrator fit(double[] scores, int[] labels) {
        if (scores.length == 0 || scores.length != labels.length) {
            return identity();
        }
        Integer[] order = new Integer[scores.length];
        for (int i = 0; i < order.length; i++) {
            order[i] = i;
        }
        Arrays.sort(order, Comparator.comparingDouble(i -> scores[i]));

        
        List<double[]> blocks = new ArrayList<>();
        int i = 0;
        while (i < order.length) {
            int j = i;
            double score = scores[order[i]];
            double sum = 0;
            int count = 0;
            while (j < order.length && scores[order[j]] == score) {
                sum += labels[order[j]];
                count++;
                j++;
            }
            blocks.add(new double[]{score, sum / count, count});
            i = j;
        }

        
        List<double[]> pooled = new ArrayList<>();
        for (double[] block : blocks) {
            pooled.add(block);
            while (pooled.size() > 1) {
                double[] last = pooled.get(pooled.size() - 1);
                double[] previous = pooled.get(pooled.size() - 2);
                if (previous[1] <= last[1]) {
                    break;
                }
                double totalWeight = previous[2] + last[2];
                double[] merged = {
                        previous[0],
                        (previous[1] * previous[2] + last[1] * last[2]) / totalWeight,
                        totalWeight
                };
                pooled.set(pooled.size() - 2, merged);
                pooled.remove(pooled.size() - 1);
            }
        }

        
        double[] thresholds = new double[pooled.size()];
        double[] values = new double[pooled.size()];
        for (int b = 0; b < pooled.size(); b++) {
            thresholds[b] = pooled.get(b)[0];
            double value = pooled.get(b)[1];
            values[b] = Math.max(0.01, Math.min(0.99, value));
        }
        return new IsotonicCalibrator(thresholds, values);
    }

    public double calibrate(double score) {
        if (thresholds.length == 0) {
            return Math.max(0.01, Math.min(0.99, score));
        }
        int low = 0;
        int high = thresholds.length - 1;
        while (low < high) {
            int mid = (low + high + 1) >>> 1;
            if (thresholds[mid] <= score) {
                low = mid;
            } else {
                high = mid - 1;
            }
        }
        return values[low];
    }

    private static IsotonicCalibrator identity() {
        return new IsotonicCalibrator(new double[0], new double[0]);
    }
}
