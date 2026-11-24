package mx.rastro.features.predictions.ml;

import java.util.Arrays;
import java.util.Comparator;


public final class Metrics {

    private Metrics() {
    }

    public static double auc(int[] y, double[] score) {
        int positives = 0;
        int negatives = 0;
        for (int value : y) {
            if (value == 1) {
                positives++;
            } else {
                negatives++;
            }
        }
        if (positives == 0 || negatives == 0) {
            return 0.5;
        }
        Integer[] order = order(score);
        double[] ranks = new double[score.length];
        int i = 0;
        while (i < order.length) {
            int j = i;
            while (j + 1 < order.length && Double.compare(score[order[j + 1]], score[order[i]]) == 0) {
                j++;
            }
            double rank = (i + 1 + j + 1) / 2.0;
            for (int k = i; k <= j; k++) {
                ranks[order[k]] = rank;
            }
            i = j + 1;
        }
        double rankSum = 0;
        for (int k = 0; k < y.length; k++) {
            if (y[k] == 1) {
                rankSum += ranks[k];
            }
        }
        return (rankSum - (double) positives * (positives + 1) / 2) / ((double) positives * negatives);
    }

    public static double averagePrecision(int[] y, double[] score) {
        Integer[] order = order(score, true);
        int positives = 0;
        for (int value : y) {
            positives += value;
        }
        if (positives == 0) {
            return 0;
        }
        int hits = 0;
        double sum = 0;
        for (int i = 0; i < order.length; i++) {
            if (y[order[i]] == 1) {
                hits++;
                sum += (double) hits / (i + 1);
            }
        }
        return sum / positives;
    }

    public static double precisionAt(int[] y, double[] score, double fraction) {
        Integer[] order = order(score, true);
        int k = Math.max(1, (int) Math.ceil(order.length * fraction));
        int hits = 0;
        for (int i = 0; i < k; i++) {
            hits += y[order[i]];
        }
        return (double) hits / k;
    }

    public static double liftAt(int[] y, double[] score, double fraction) {
        double prevalence = prevalence(y);
        return prevalence == 0 ? 0 : precisionAt(y, score, fraction) / prevalence;
    }

    public static double brier(int[] y, double[] probability) {
        double sum = 0;
        for (int i = 0; i < y.length; i++) {
            double delta = probability[i] - y[i];
            sum += delta * delta;
        }
        return sum / y.length;
    }

    public static double prevalence(int[] y) {
        int positives = 0;
        for (int value : y) {
            positives += value;
        }
        return (double) positives / y.length;
    }

    public static double mae(double[] actual, double[] predicted) {
        double sum = 0;
        for (int i = 0; i < actual.length; i++) {
            sum += Math.abs(actual[i] - predicted[i]);
        }
        return sum / actual.length;
    }

    public static double rmse(double[] actual, double[] predicted) {
        double sum = 0;
        for (int i = 0; i < actual.length; i++) {
            double delta = actual[i] - predicted[i];
            sum += delta * delta;
        }
        return Math.sqrt(sum / actual.length);
    }

    public static double spearman(double[] a, double[] b) {
        if (a.length < 2) {
            return 0;
        }
        double[] ra = ranks(a);
        double[] rb = ranks(b);
        double meanA = Arrays.stream(ra).average().orElse(0);
        double meanB = Arrays.stream(rb).average().orElse(0);
        double num = 0;
        double da = 0;
        double db = 0;
        for (int i = 0; i < a.length; i++) {
            num += (ra[i] - meanA) * (rb[i] - meanB);
            da += (ra[i] - meanA) * (ra[i] - meanA);
            db += (rb[i] - meanB) * (rb[i] - meanB);
        }
        return da == 0 || db == 0 ? 0 : num / Math.sqrt(da * db);
    }

    private static double[] ranks(double[] values) {
        Integer[] order = new Integer[values.length];
        for (int i = 0; i < order.length; i++) {
            order[i] = i;
        }
        Arrays.sort(order, Comparator.comparingDouble(i -> values[i]));
        double[] ranks = new double[values.length];
        int i = 0;
        while (i < order.length) {
            int j = i;
            while (j + 1 < order.length && Double.compare(values[order[j + 1]], values[order[i]]) == 0) {
                j++;
            }
            double rank = (i + 1 + j + 1) / 2.0;
            for (int k = i; k <= j; k++) {
                ranks[order[k]] = rank;
            }
            i = j + 1;
        }
        return ranks;
    }

    private static Integer[] order(double[] score) {
        return order(score, false);
    }

    private static Integer[] order(double[] score, boolean descending) {
        Integer[] order = new Integer[score.length];
        for (int i = 0; i < order.length; i++) {
            order[i] = i;
        }
        Comparator<Integer> comparator = Comparator.comparingDouble(i -> score[i]);
        if (descending) {
            comparator = comparator.reversed();
        }
        Arrays.sort(order, comparator);
        return order;
    }
}
