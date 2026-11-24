package mx.rastro.features.predictions.ml;

import java.util.ArrayList;
import java.util.List;
import java.util.SplittableRandom;






public final class RandomForestClassifier {

    private final int trees;
    private final int maxDepth;
    private final int minLeaf;
    private final long seed;

    private List<Tree> forest = List.of();
    private double[] importance = new double[0];
    private int featureCount;

    public RandomForestClassifier(int trees, int maxDepth, int minLeaf, long seed) {
        this.trees = Math.max(10, trees);
        this.maxDepth = Math.max(2, maxDepth);
        this.minLeaf = Math.max(1, minLeaf);
        this.seed = seed;
    }

    public void fit(double[][] x, int[] y) {
        if (x.length == 0 || x.length != y.length) {
            throw new IllegalArgumentException("Matriz de entrenamiento inválida");
        }
        featureCount = x[0].length;
        SplittableRandom random = new SplittableRandom(seed);
        List<Tree> trained = new ArrayList<>(trees);
        double[] totalImportance = new double[featureCount];
        for (int t = 0; t < trees; t++) {
            int[] sample = new int[x.length];
            for (int i = 0; i < sample.length; i++) {
                sample[i] = random.nextInt(x.length);
            }
            Tree tree = new Tree(maxDepth, minLeaf, random.nextLong());
            tree.fit(x, y, sample);
            trained.add(tree);
            double[] local = tree.importance();
            for (int f = 0; f < featureCount; f++) {
                totalImportance[f] += local[f];
            }
        }
        double sum = 0;
        for (double value : totalImportance) {
            sum += value;
        }
        if (sum > 0) {
            for (int f = 0; f < featureCount; f++) {
                totalImportance[f] /= sum;
            }
        }
        this.forest = List.copyOf(trained);
        this.importance = totalImportance;
    }

    public double predictProba(double[] x) {
        if (forest.isEmpty()) {
            throw new IllegalStateException("Modelo no entrenado");
        }
        double sum = 0;
        for (Tree tree : forest) {
            sum += tree.predict(x);
        }
        return sum / forest.size();
    }

    public double[] importance() {
        return importance.clone();
    }

    private static final class Tree {
        private final int maxDepth;
        private final int minLeaf;
        private final SplittableRandom random;
        private final double[] importance;
        private Node root;

        private Tree(int maxDepth, int minLeaf, long seed) {
            this.maxDepth = maxDepth;
            this.minLeaf = minLeaf;
            this.random = new SplittableRandom(seed);
            this.importance = new double[0];
        }

        private double[] importanceLocal;

        private void fit(double[][] x, int[] y, int[] sample) {
            importanceLocal = new double[x[0].length];
            root = build(x, y, sample, 0);
        }

        private double[] importance() {
            return importanceLocal == null ? new double[0] : importanceLocal;
        }

        private Node build(double[][] x, int[] y, int[] indices, int depth) {
            int positives = 0;
            for (int index : indices) {
                positives += y[index];
            }
            int n = indices.length;
            double proba = (positives + 1.0) / (n + 2.0);
            if (depth >= maxDepth || n < minLeaf * 2 || positives == 0 || positives == n) {
                return Node.leaf(proba);
            }

            int features = x[0].length;
            int candidates = Math.max(1, (int) Math.round(Math.sqrt(features)));
            int[] order = new int[features];
            for (int i = 0; i < features; i++) {
                order[i] = i;
            }
            for (int i = 0; i < candidates; i++) {
                int j = i + random.nextInt(features - i);
                int tmp = order[i];
                order[i] = order[j];
                order[j] = tmp;
            }

            double parentGini = gini(positives, n);
            double bestGain = 1e-9;
            int bestFeature = -1;
            double bestThreshold = 0;
            for (int c = 0; c < candidates; c++) {
                int feature = order[c];
                double min = Double.POSITIVE_INFINITY;
                double max = Double.NEGATIVE_INFINITY;
                for (int index : indices) {
                    double value = x[index][feature];
                    if (value < min) {
                        min = value;
                    }
                    if (value > max) {
                        max = value;
                    }
                }
                if (!(max > min)) {
                    continue;
                }
                int bins = 16;
                int[] posBins = new int[bins];
                int[] negBins = new int[bins];
                double scale = bins / (max - min);
                for (int index : indices) {
                    int bin = (int) ((x[index][feature] - min) * scale);
                    if (bin >= bins) {
                        bin = bins - 1;
                    }
                    if (y[index] == 1) {
                        posBins[bin]++;
                    } else {
                        negBins[bin]++;
                    }
                }
                int leftPos = 0;
                int leftNeg = 0;
                for (int b = 0; b < bins - 1; b++) {
                    leftPos += posBins[b];
                    leftNeg += negBins[b];
                    int left = leftPos + leftNeg;
                    int right = n - left;
                    if (left < minLeaf || right < minLeaf) {
                        continue;
                    }
                    double weighted = ((double) left / n) * gini(leftPos, left)
                            + ((double) right / n) * gini(positives - leftPos, right);
                    double gain = parentGini - weighted;
                    if (gain > bestGain) {
                        bestGain = gain;
                        bestFeature = feature;
                        bestThreshold = min + (max - min) * (b + 1) / bins;
                    }
                }
            }

            if (bestFeature < 0) {
                return Node.leaf(proba);
            }
            int leftCount = 0;
            for (int index : indices) {
                if (x[index][bestFeature] <= bestThreshold) {
                    leftCount++;
                }
            }
            if (leftCount < minLeaf || n - leftCount < minLeaf) {
                return Node.leaf(proba);
            }
            int[] leftIndices = new int[leftCount];
            int[] rightIndices = new int[n - leftCount];
            int li = 0;
            int ri = 0;
            for (int index : indices) {
                if (x[index][bestFeature] <= bestThreshold) {
                    leftIndices[li++] = index;
                } else {
                    rightIndices[ri++] = index;
                }
            }
            if (importanceLocal != null) {
                importanceLocal[bestFeature] += bestGain * n;
            }
            return Node.split(bestFeature, bestThreshold,
                    build(x, y, leftIndices, depth + 1),
                    build(x, y, rightIndices, depth + 1));
        }

        private double predict(double[] x) {
            Node node = root;
            while (node != null && !node.isLeaf()) {
                node = x[node.feature()] <= node.threshold() ? node.left() : node.right();
            }
            return node == null ? 0.5 : node.proba();
        }

        private static double gini(int positives, int total) {
            if (total <= 0) {
                return 0;
            }
            double p = (double) positives / total;
            return 2 * p * (1 - p);
        }
    }

    private record Node(int feature, double threshold, Node left, Node right, double proba) {
        static Node leaf(double proba) {
            return new Node(-1, 0, null, null, proba);
        }

        static Node split(int feature, double threshold, Node left, Node right) {
            return new Node(feature, threshold, left, right, 0);
        }

        boolean isLeaf() {
            return feature < 0;
        }
    }
}
