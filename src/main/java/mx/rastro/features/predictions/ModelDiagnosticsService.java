package mx.rastro.features.predictions;

import mx.rastro.features.catalog.Catalog;
import mx.rastro.features.catalog.Municipality;
import mx.rastro.features.catalog.State;
import mx.rastro.features.dataset.DatasetService;
import mx.rastro.features.dataset.DatasetSnapshot;
import mx.rastro.features.predictions.ml.Metrics;
import mx.rastro.features.predictions.ml.ModelFactory;
import mx.rastro.features.predictions.ml.RandomForestClassifier;
import mx.rastro.shared.util.Haversine;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;











@Service
public class ModelDiagnosticsService {

    private static final long SEED = 20261118L;
    private static final int FOLDS = 8;
    private static final int REPEATS = 3;
    private static final int PERMUTATIONS = 19;
    private static final double KDE_BANDWIDTH_KM = 120.0;
    private static final int M3_HISTORY_FROM = 2015;
    private static final int M3_HISTORY_TO = 2024;

    private final DatasetService datasetService;
    private final PredictionDataLoader dataLoader;
    private final ModelFactory modelFactory;

    public ModelDiagnosticsService(DatasetService datasetService, PredictionDataLoader dataLoader,
                                   ModelFactory modelFactory) {
        this.datasetService = datasetService;
        this.dataLoader = dataLoader;
        this.modelFactory = modelFactory;
    }

    public Report evaluate() {
        DatasetSnapshot dataset = datasetService.snapshot();
        Rows rows = rows(dataset);
        Repeated repeated = repeatedValidation(rows);
        Permutation permutation = permutationTest(rows);
        String verdict = verdict(repeated, permutation);
        return new Report(
                REPEATS,
                FOLDS,
                PERMUTATIONS,
                repeated.m0(),
                repeated.m2Regularized(),
                repeated.m3(),
                round(repeated.m3().apMean() - repeated.m2Regularized().apMean()),
                round(repeated.pairedDifferenceMean()),
                round(repeated.pairedDifferenceCiLow()),
                round(repeated.pairedDifferenceCiHigh()),
                round(repeated.pairedWinRate()),
                round(permutation.pValue()),
                round(permutation.actualAp()),
                round(permutation.meanPermutedAp()),
                round(inSampleAp(rows.matrix(), rows.labels())),
                round(inSampleAp(rows.matrixM3(), rows.labels())),
                calibrationEce(repeated.calibration()),
                repeated.calibration(),
                verdict);
    }

    private Rows rows(DatasetSnapshot dataset) {
        Catalog catalog = dataset.catalog();
        PredictionData data = dataLoader.load();

        Map<String, Integer> historialMunicipio = new HashMap<>();
        Map<String, Integer> historialEstado = new HashMap<>();
        for (var record : dataset.records()) {
            if (record.fechaVisto() == null || !record.estatus().isMissing()) {
                continue;
            }
            int year = record.fechaVisto().getYear();
            if (year < M3_HISTORY_FROM || year > M3_HISTORY_TO) {
                continue;
            }
            if (record.municipioId() != null && !record.municipioId().isBlank()) {
                historialMunicipio.merge(record.municipioId(), 1, Integer::sum);
            }
            if (record.estadoId() != null && !record.estadoId().isBlank()) {
                historialEstado.merge(record.estadoId(), 1, Integer::sum);
            }
        }

        Map<String, Integer> stateFosas = new HashMap<>();
        Map<String, Double> stateRate = new HashMap<>();
        for (State state : catalog.states().values()) {
            int fosas = data.stateFosas().getOrDefault(state.id(), 0);
            stateFosas.put(state.id(), fosas);
            stateRate.put(state.id(), (fosas + 1.0) / (Math.max(1, state.poblacion()) / 100_000.0 + 10.0));
        }

        double maxKde = 0;
        List<Double> densities = new ArrayList<>(catalog.allMunicipalities().size());
        for (Municipality municipality : catalog.allMunicipalities()) {
            double density = 0;
            for (State state : catalog.states().values()) {
                double distance = Haversine.km(municipality.lat(), municipality.lon(), state.lat(), state.lon());
                density += stateFosas.getOrDefault(state.id(), 0)
                        * Math.exp(-0.5 * Math.pow(distance / KDE_BANDWIDTH_KM, 2));
            }
            densities.add(density);
            maxKde = Math.max(maxKde, density);
        }

        List<Sample> samples = new ArrayList<>(catalog.allMunicipalities().size());
        int index = 0;
        for (Municipality municipality : catalog.allMunicipalities()) {
            State state = catalog.state(municipality.estadoId());
            double population = Math.max(0, municipality.poblacion());
            double rate = stateRate.getOrDefault(municipality.estadoId(), 0.0);
            double distanceCenter = Haversine.km(municipality.lat(), municipality.lon(), state.lat(), state.lon());
            double[] features = {
                    Math.log1p(population),
                    municipality.lat(),
                    municipality.lon(),
                    Math.log1p(stateFosas.getOrDefault(state.id(), 0)),
                    rate,
                    distanceCenter,
                    borderDistance(municipality.lat(), municipality.lon()),
                    Math.log1p(state.municipios()),
                    Math.log1p(state.poblacion())
            };
            int missingMunicipality = historialMunicipio.getOrDefault(municipality.id(), 0);
            int missingState = historialEstado.getOrDefault(municipality.estadoId(), 0);
            double[] m3Features = Arrays.copyOf(features, 13);
            m3Features[9] = Math.log1p(missingMunicipality);
            m3Features[10] = missingMunicipality / (Math.max(1, population) / 100_000.0);
            m3Features[11] = Math.log1p(missingState);
            m3Features[12] = missingState / (Math.max(1, state.poblacion()) / 100_000.0);
            double kde = maxKde > 0 ? densities.get(index) / maxKde : 0;
            int label = data.presence().getOrDefault(municipality.id(), 0);
            samples.add(new Sample(municipality.estadoId(), features, m3Features, label, kde, rate,
                    municipality.poblacion()));
            index++;
        }

        double[][] matrix = new double[samples.size()][];
        double[][] matrixM3 = new double[samples.size()][];
        int[] labels = new int[samples.size()];
        for (int i = 0; i < samples.size(); i++) {
            matrix[i] = samples.get(i).features();
            matrixM3[i] = samples.get(i).m3Features();
            labels[i] = samples.get(i).label();
        }
        return new Rows(catalog, samples, matrix, matrixM3, labels);
    }

    private Repeated repeatedValidation(Rows rows) {
        List<Double> m0Ap = new ArrayList<>();
        List<Double> m0Auc = new ArrayList<>();
        List<Double> m0Precision = new ArrayList<>();
        List<Double> m0Recall = new ArrayList<>();
        List<Double> m0Brier = new ArrayList<>();
        List<Double> m2Ap = new ArrayList<>();
        List<Double> m2Auc = new ArrayList<>();
        List<Double> m2Precision = new ArrayList<>();
        List<Double> m2Recall = new ArrayList<>();
        List<Double> m2Brier = new ArrayList<>();
        List<Double> m3Ap = new ArrayList<>();
        List<Double> m3Auc = new ArrayList<>();
        List<Double> m3Precision = new ArrayList<>();
        List<Double> m3Recall = new ArrayList<>();
        List<Double> m3Brier = new ArrayList<>();
        List<Double> differences = new ArrayList<>();
        List<Double> calibrationProbabilities = new ArrayList<>();
        List<Integer> calibrationLabels = new ArrayList<>();

        List<String> stateIds = new ArrayList<>(rows.catalog().states().keySet());
        for (int repeat = 0; repeat < REPEATS; repeat++) {
            Collections.shuffle(stateIds, new Random(SEED + repeat * 104_729L));
            Map<String, Integer> foldOfState = new HashMap<>();
            for (int i = 0; i < stateIds.size(); i++) {
                foldOfState.put(stateIds.get(i), i % FOLDS);
            }
            for (int fold = 0; fold < FOLDS; fold++) {
                FoldIndices indices = foldIndices(rows, foldOfState, fold);
                if (indices == null) {
                    continue;
                }
                int[] testY = labels(rows, indices.test());
                if (Arrays.stream(testY).sum() == 0 || Arrays.stream(testY).sum() == testY.length) {
                    continue;
                }
                double[] m0 = new double[indices.test().size()];
                for (int i = 0; i < indices.test().size(); i++) {
                    Sample sample = rows.samples().get(indices.test().get(i));
                    m0[i] = sample.rate() * Math.max(1, sample.municipalityPopulation()) / 100_000.0;
                }
                ForkJoinResult m2 = fitAndPredict(rows.matrix(), rows.labels(), indices);
                ForkJoinResult m3 = fitAndPredict(rows.matrixM3(), rows.labels(), indices);

                add(m0Ap, Metrics.averagePrecision(testY, m0));
                add(m0Auc, Metrics.auc(testY, m0));
                add(m0Precision, Metrics.precisionAt(testY, m0, 0.10));
                add(m0Recall, recallAt(testY, m0, 0.10));
                add(m0Brier, Metrics.brier(testY, m0));
                add(m2Ap, Metrics.averagePrecision(testY, m2.predictions()));
                add(m2Auc, Metrics.auc(testY, m2.predictions()));
                add(m2Precision, Metrics.precisionAt(testY, m2.predictions(), 0.10));
                add(m2Recall, recallAt(testY, m2.predictions(), 0.10));
                add(m2Brier, Metrics.brier(testY, m2.predictions()));
                add(m3Ap, Metrics.averagePrecision(testY, m3.predictions()));
                add(m3Auc, Metrics.auc(testY, m3.predictions()));
                add(m3Precision, Metrics.precisionAt(testY, m3.predictions(), 0.10));
                add(m3Recall, recallAt(testY, m3.predictions(), 0.10));
                add(m3Brier, Metrics.brier(testY, m3.predictions()));
                add(differences, Metrics.averagePrecision(testY, m3.predictions())
                        - Metrics.averagePrecision(testY, m2.predictions()));
                for (int i = 0; i < testY.length; i++) {
                    calibrationProbabilities.add(m3.predictions()[i]);
                    calibrationLabels.add(testY[i]);
                }
            }
        }

        ModelSummary m0 = summary("m0", "Persistencia histórica", m0Ap, m0Auc, m0Precision, m0Recall,
                null);
        ModelSummary m2 = summary("m2-reg", "M2 con regularización M3, 9 variables", m2Ap, m2Auc,
                m2Precision, m2Recall, mean(m2Brier));
        ModelSummary m3 = summary("m3", "M3, 13 variables", m3Ap, m3Auc, m3Precision, m3Recall,
                mean(m3Brier));
        return new Repeated(m0, m2, m3, mean(differences), sd(differences),
                mean(differences) - 1.96 * standardError(differences),
                mean(differences) + 1.96 * standardError(differences),
                differences.stream().filter(value -> value > 0).count() / (double) differences.size(),
                calibration(calibrationProbabilities, calibrationLabels));
    }

    private Permutation permutationTest(Rows rows) {
        
        List<String> states = new ArrayList<>(rows.catalog().states().keySet());
        Collections.shuffle(states, new Random(SEED));
        Map<String, Integer> foldOfState = new HashMap<>();
        for (int i = 0; i < states.size(); i++) {
            foldOfState.put(states.get(i), i % FOLDS);
        }
        List<FoldIndices> splits = new ArrayList<>();
        for (int fold = 0; fold < FOLDS; fold++) {
            FoldIndices indices = foldIndices(rows, foldOfState, fold);
            if (indices != null) {
                splits.add(indices);
            }
        }
        List<Double> actualFolds = new ArrayList<>();
        for (FoldIndices split : splits) {
            ForkJoinResult result = fitAndPredict(rows.matrixM3(), rows.labels(), split);
            actualFolds.add(Metrics.averagePrecision(labels(rows, split.test()), result.predictions()));
        }
        double actual = mean(actualFolds);

        List<Double> permutedMeans = new ArrayList<>();
        Random random = new Random(SEED + 44_791L);
        for (int permutation = 0; permutation < PERMUTATIONS; permutation++) {
            int[] order = new int[rows.samples().size()];
            for (int i = 0; i < order.length; i++) {
                order[i] = i;
            }
            for (int i = order.length - 1; i > 0; i--) {
                int j = random.nextInt(i + 1);
                int tmp = order[i];
                order[i] = order[j];
                order[j] = tmp;
            }
            double[][] shuffled = new double[rows.matrixM3().length][];
            for (int i = 0; i < shuffled.length; i++) {
                double[] original = rows.matrixM3()[i];
                double[] donor = rows.matrixM3()[order[i]];
                shuffled[i] = Arrays.copyOf(original, original.length);
                for (int column = 9; column < 13; column++) {
                    shuffled[i][column] = donor[column];
                }
            }
            List<Double> values = new ArrayList<>();
            for (FoldIndices split : splits) {
                ForkJoinResult result = fitAndPredict(shuffled, rows.labels(), split);
                values.add(Metrics.averagePrecision(labels(rows, split.test()), result.predictions()));
            }
            permutedMeans.add(mean(values));
        }
        long notBetter = permutedMeans.stream().filter(value -> value < actual).count();
        double pValue = (PERMUTATIONS - notBetter + 1.0) / (PERMUTATIONS + 1.0);
        return new Permutation(actual, mean(permutedMeans), pValue);
    }

    private ForkJoinResult fitAndPredict(double[][] matrix, int[] labels, FoldIndices indices) {
        double[][] trainX = new double[indices.train().size()][];
        int[] trainY = new int[indices.train().size()];
        for (int i = 0; i < indices.train().size(); i++) {
            trainX[i] = matrix[indices.train().get(i)];
            trainY[i] = labels[indices.train().get(i)];
        }
        RandomForestClassifier forest = modelFactory.challengerForest(SEED + 919L + indices.fold() * 31L);
        forest.fit(trainX, trainY);
        double[] predictions = new double[indices.test().size()];
        for (int i = 0; i < indices.test().size(); i++) {
            predictions[i] = forest.predictProba(matrix[indices.test().get(i)]);
        }
        return new ForkJoinResult(predictions);
    }

    private FoldIndices foldIndices(Rows rows, Map<String, Integer> foldOfState, int fold) {
        List<Integer> train = new ArrayList<>();
        List<Integer> test = new ArrayList<>();
        for (int i = 0; i < rows.samples().size(); i++) {
            if (foldOfState.get(rows.samples().get(i).estadoId()) == fold) {
                test.add(i);
            } else {
                train.add(i);
            }
        }
        return test.size() < 10 ? null : new FoldIndices(fold, train, test);
    }

    private int[] labels(Rows rows, List<Integer> indexes) {
        int[] labels = new int[indexes.size()];
        for (int i = 0; i < indexes.size(); i++) {
            labels[i] = rows.labels()[indexes.get(i)];
        }
        return labels;
    }

    private ModelSummary summary(String id, String name, List<Double> ap, List<Double> auc,
                                 List<Double> precision, List<Double> recall, Double brier) {
        return new ModelSummary(id, name, mean(ap), sd(ap), mean(auc), mean(precision), mean(recall),
                brier);
    }

    private double inSampleAp(double[][] matrix, int[] labels) {
        RandomForestClassifier forest = modelFactory.challengerForest(SEED + 55_555L);
        forest.fit(matrix, labels);
        double[] predictions = new double[matrix.length];
        for (int i = 0; i < matrix.length; i++) {
            predictions[i] = forest.predictProba(matrix[i]);
        }
        return Metrics.averagePrecision(labels, predictions);
    }

    private double calibrationEce(List<CalibrationBin> bins) {
        int total = bins.stream().mapToInt(CalibrationBin::count).sum();
        if (total == 0) {
            return 0;
        }
        double error = 0;
        for (CalibrationBin bin : bins) {
            error += (double) bin.count() / total * Math.abs(bin.observed() - bin.meanPredicted());
        }
        return error;
    }

    private List<CalibrationBin> calibration(List<Double> probabilities, List<Integer> labels) {
        double[] predicted = new double[10];
        int[] count = new int[10];
        int[] positives = new int[10];
        for (int i = 0; i < probabilities.size(); i++) {
            int bin = Math.min(9, Math.max(0, (int) (probabilities.get(i) * 10)));
            predicted[bin] += probabilities.get(i);
            count[bin]++;
            positives[bin] += labels.get(i);
        }
        List<CalibrationBin> result = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            if (count[i] > 0) {
                result.add(new CalibrationBin(i + 1, count[i],
                        round(predicted[i] / count[i]), round((double) positives[i] / count[i])));
            }
        }
        return List.copyOf(result);
    }

    private String verdict(Repeated repeated, Permutation permutation) {
        double gain = repeated.m3().apMean() - repeated.m2Regularized().apMean();
        boolean positiveInterval = repeated.pairedDifferenceCiLow() > 0;
        boolean permutationSignal = permutation.pValue() <= 0.05;
        boolean meaningful = gain >= 0.03;
        if (meaningful && positiveInterval && permutationSignal) {
            return "La historia municipal aporta señal consistente fuera de entidad y la permutación la "
                    + "degrada. No hay evidencia de sobreajuste severo; sigue sin ser validación temporal/prospectiva.";
        }
        if (!meaningful || !positiveInterval) {
            return "La mejora se explica por la regularización, no por la historia municipal, o no es estable. "
                    + "M3 no debe presentarse como superior.";
        }
        return "La mejora existe, pero la prueba de permutación no es concluyente. Posible sobreajuste o señal "
                + "de reporte; no publicar como predictor validado.";
    }

    private static void add(List<Double> list, double value) {
        list.add(value);
    }

    private static double mean(List<Double> values) {
        return values.stream().mapToDouble(Double::doubleValue).average().orElse(0);
    }

    private static double sd(List<Double> values) {
        if (values.size() < 2) {
            return 0;
        }
        double mean = mean(values);
        double sum = 0;
        for (double value : values) {
            sum += (value - mean) * (value - mean);
        }
        return Math.sqrt(sum / (values.size() - 1));
    }

    private static double standardError(List<Double> values) {
        return values.isEmpty() ? 0 : sd(values) / Math.sqrt(values.size());
    }

    private static double recallAt(int[] labels, double[] score, double fraction) {
        Integer[] order = new Integer[score.length];
        for (int i = 0; i < order.length; i++) {
            order[i] = i;
        }
        Arrays.sort(order, (a, b) -> Double.compare(score[b], score[a]));
        int k = Math.max(1, (int) Math.ceil(order.length * fraction));
        int hits = 0;
        int positives = Arrays.stream(labels).sum();
        for (int i = 0; i < k; i++) {
            hits += labels[order[i]];
        }
        return positives == 0 ? 0 : (double) hits / positives;
    }

    private static double borderDistance(double lat, double lon) {
        double[][] border = {
                {32.54, -117.12}, {32.72, -114.60}, {31.33, -111.00}, {31.33, -108.20},
                {31.78, -106.50}, {29.76, -104.40}, {29.54, -101.40}, {26.00, -99.10}, {25.90, -97.10}
        };
        double min = Double.POSITIVE_INFINITY;
        for (double[] point : border) {
            min = Math.min(min, Haversine.km(lat, lon, point[0], point[1]));
        }
        return min;
    }

    private static double round(double value) {
        return Math.round(value * 1000.0) / 1000.0;
    }

    private record Rows(Catalog catalog, List<Sample> samples, double[][] matrix, double[][] matrixM3,
                        int[] labels) {
    }

    private record Sample(String estadoId, double[] features, double[] m3Features, int label, double kde,
                          double rate, int municipalityPopulation) {
    }

    private record FoldIndices(int fold, List<Integer> train, List<Integer> test) {
    }

    private record ForkJoinResult(double[] predictions) {
    }

    private record Repeated(ModelSummary m0, ModelSummary m2Regularized, ModelSummary m3,
                            double pairedDifferenceMean, double pairedDifferenceSd,
                            double pairedDifferenceCiLow, double pairedDifferenceCiHigh,
                            double pairedWinRate, List<CalibrationBin> calibration) {
    }

    private record Permutation(double actualAp, double meanPermutedAp, double pValue) {
    }

    public record Report(
            int repeats,
            int folds,
            int permutations,
            ModelSummary m0,
            ModelSummary m2Regularized,
            ModelSummary m3,
            double m3MinusM2Ap,
            double pairedDifferenceMean,
            double pairedDifferenceCiLow,
            double pairedDifferenceCiHigh,
            double pairedWinRate,
            double permutationPValue,
            double permutationActualAp,
            double permutationMeanAp,
            double m2RegularizedInSampleAp,
            double m3InSampleAp,
            double calibrationEce,
            List<CalibrationBin> calibration,
            String verdict) {
    }

    public record ModelSummary(
            String id,
            String name,
            double apMean,
            double apSd,
            double aucMean,
            double precision10Mean,
            double recall10Mean,
            Double brierMean) {
    }

    public record CalibrationBin(int decile, int count, double meanPredicted, double observed) {
    }
}
