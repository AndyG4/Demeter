package mx.rastro.features.predictions.ml;

import java.util.SplittableRandom;


public final class KMeans {

    private KMeans() {
    }

    public record Result(int[] labels, double[][] centroids, double inertia, int iterations) {
    }

    public static Result fit(double[][] data, int k, int maxIterations, long seed) {
        if (data.length == 0 || k <= 1) {
            int[] labels = new int[data.length];
            return new Result(labels, new double[][]{data.length == 0 ? new double[0] : data[0].clone()}, 0, 0);
        }
        int n = data.length;
        int d = data[0].length;
        SplittableRandom random = new SplittableRandom(seed);
        double[][] centroids = new double[k][d];

        int first = random.nextInt(n);
        System.arraycopy(data[first], 0, centroids[0], 0, d);
        double[] minDistance = new double[n];
        for (int i = 0; i < n; i++) {
            minDistance[i] = squared(data[i], centroids[0]);
        }
        for (int c = 1; c < k; c++) {
            double total = 0;
            for (double value : minDistance) {
                total += value;
            }
            double target = random.nextDouble() * total;
            int chosen = 0;
            double accumulated = 0;
            for (int i = 0; i < n; i++) {
                accumulated += minDistance[i];
                if (accumulated >= target) {
                    chosen = i;
                    break;
                }
            }
            System.arraycopy(data[chosen], 0, centroids[c], 0, d);
            for (int i = 0; i < n; i++) {
                minDistance[i] = Math.min(minDistance[i], squared(data[i], centroids[c]));
            }
        }

        int[] labels = new int[n];
        java.util.Arrays.fill(labels, -1);
        int iteration = 0;
        boolean changed = true;
        while (changed && iteration < maxIterations) {
            changed = false;
            iteration++;
            for (int i = 0; i < n; i++) {
                int best = 0;
                double bestDistance = Double.POSITIVE_INFINITY;
                for (int c = 0; c < k; c++) {
                    double distance = squared(data[i], centroids[c]);
                    if (distance < bestDistance) {
                        bestDistance = distance;
                        best = c;
                    }
                }
                if (labels[i] != best) {
                    labels[i] = best;
                    changed = true;
                }
            }
            double[][] sums = new double[k][d];
            int[] counts = new int[k];
            for (int i = 0; i < n; i++) {
                int label = labels[i];
                counts[label]++;
                for (int j = 0; j < d; j++) {
                    sums[label][j] += data[i][j];
                }
            }
            for (int c = 0; c < k; c++) {
                if (counts[c] == 0) {
                    int farthest = farthestPoint(data, centroids, labels);
                    labels[farthest] = c;
                    counts[c] = 1;
                    System.arraycopy(data[farthest], 0, centroids[c], 0, d);
                    continue;
                }
                for (int j = 0; j < d; j++) {
                    centroids[c][j] = sums[c][j] / counts[c];
                }
            }
        }

        double inertia = 0;
        for (int i = 0; i < n; i++) {
            inertia += squared(data[i], centroids[labels[i]]);
        }
        return new Result(labels, centroids, inertia, iteration);
    }

    private static int farthestPoint(double[][] data, double[][] centroids, int[] labels) {
        int farthest = 0;
        double max = -1;
        for (int i = 0; i < data.length; i++) {
            double distance = squared(data[i], centroids[labels[i] < 0 ? 0 : labels[i]]);
            if (distance > max) {
                max = distance;
                farthest = i;
            }
        }
        return farthest;
    }

    private static double squared(double[] a, double[] b) {
        double sum = 0;
        for (int i = 0; i < a.length; i++) {
            double delta = a[i] - b[i];
            sum += delta * delta;
        }
        return sum;
    }
}
