package mx.rastro.features.predictions;

import mx.rastro.features.catalog.Catalog;
import mx.rastro.features.catalog.Municipality;
import mx.rastro.features.catalog.State;
import mx.rastro.features.dataset.DatasetService;
import mx.rastro.features.dataset.DatasetSnapshot;
import mx.rastro.features.predictions.ModelReport.FoldResult;
import mx.rastro.features.predictions.ModelReport.ModelMetrics;
import mx.rastro.features.predictions.ModelReport.TemporalMetrics;
import mx.rastro.features.predictions.ml.KMeans;
import mx.rastro.features.predictions.ml.IsotonicCalibrator;
import mx.rastro.features.predictions.ml.Metrics;
import mx.rastro.features.predictions.ml.ModelFactory;
import mx.rastro.features.predictions.ml.RandomForestClassifier;
import mx.rastro.features.predictions.ml.SpatialGraph;
import mx.rastro.shared.util.Haversine;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.atomic.AtomicReference;








@Service
public class PredictionService {

    private static final Logger log = LoggerFactory.getLogger(PredictionService.class);
    private static final long SEED = 20261118L;
    private static final int FOLDS = 8;
    private static final int K_CLUSTERS = 5;
    private static final double KDE_BANDWIDTH_KM = 120.0;
    private static final List<String> FEATURE_NAMES = List.of(
            "log_poblacion",
            "latitud",
            "longitud",
            "fosas_entidad_log",
            "tasa_fosas_100k",
            "distancia_centro_entidad_km",
            "distancia_frontera_km",
            "municipios_entidad_log",
            "poblacion_entidad_log");

    



    private static final List<String> M3_FEATURE_NAMES = List.of(
            "log_poblacion",
            "latitud",
            "longitud",
            "fosas_entidad_log",
            "tasa_fosas_100k",
            "distancia_centro_entidad_km",
            "distancia_frontera_km",
            "municipios_entidad_log",
            "poblacion_entidad_log",
            "desapariciones_municipio_2015_2024_log",
            "tasa_desapariciones_municipio_100k",
            "desapariciones_estado_2015_2024_log",
            "tasa_desapariciones_estado_100k");

    private static final int M3_HISTORY_FROM = 2015;
    private static final int M3_HISTORY_TO = 2024;

    private static final String WARNING = "El modelo ordena prioridades de búsqueda a partir de fosas documentadas "
            + "(2006-2024) y variables públicas. No localiza fosas concretas, no estima probabilidad de encontrar "
            + "restos y no permite inferir autoría ni motivación. La validación es espacial, no prospectiva: "
            + "mide qué tan bien se recuperan municipios ya documentados en entidades no vistas durante el entrenamiento. "
            + "M3 usa historia municipal 2015-2024; los datos de 2025-2026 quedan fuera del entrenamiento y no ajustan "
            + "sus hiperparámetros.";

    private static final double[][] BORDER_POINTS = {
            {32.54, -117.12}, {32.72, -114.60}, {31.33, -111.00}, {31.33, -108.20},
            {31.78, -106.50}, {29.76, -104.40}, {29.54, -101.40}, {26.00, -99.10}, {25.90, -97.10}
    };

    private final DatasetService datasetService;
    private final PredictionDataLoader dataLoader;
    private final ModelFactory modelFactory;
    private final AtomicReference<ModelBundle> current = new AtomicReference<>();
    private final Object lock = new Object();

    public PredictionService(DatasetService datasetService, PredictionDataLoader dataLoader,
                             ModelFactory modelFactory) {
        this.datasetService = datasetService;
        this.dataLoader = dataLoader;
        this.modelFactory = modelFactory;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void warmUp() {
        try {
            ensure(datasetService.snapshot());
        } catch (RuntimeException ex) {
            log.warn("No fue posible precalentar el modelo: {}", ex.getMessage());
        }
    }

    @EventListener
    public void onDatasetChanged(mx.rastro.features.dataset.DatasetChangedEvent event) {
        try {
            ensure(event.snapshot());
        } catch (RuntimeException ex) {
            log.warn("No fue posible reentrenar tras la actualización: {}", ex.getMessage());
        }
    }

    public ModelBundle bundle() {
        DatasetSnapshot dataset = datasetService.snapshot();
        ModelBundle bundle = current.get();
        if (bundle != null && bundle.version().equals(dataset.version())) {
            return bundle;
        }
        return ensure(dataset);
    }

    public ModelBundle ensure(DatasetSnapshot dataset) {
        ModelBundle bundle = current.get();
        if (bundle != null && bundle.version().equals(dataset.version())) {
            return bundle;
        }
        synchronized (lock) {
            bundle = current.get();
            if (bundle != null && bundle.version().equals(dataset.version())) {
                return bundle;
            }
            long start = System.nanoTime();
            ModelBundle built = train(dataset);
            current.set(built);
            log.info("Modelo entrenado en {} ms (modelo seleccionado={}, AP={})",
                    (System.nanoTime() - start) / 1_000_000,
                    built.report().modeloSeleccionado(),
                    built.report().modelos().stream()
                            .filter(m -> m.id().equals(built.report().modeloSeleccionado()))
                            .mapToDouble(ModelMetrics::ap).findFirst().orElse(0));
            return built;
        }
    }

    public List<PredictionCell> cells(String estadoId, int limit) {
        ModelBundle bundle = bundle();
        List<PredictionCell> cells = bundle.cells();
        if (estadoId != null && !estadoId.isBlank()) {
            cells = cells.stream().filter(c -> c.estadoId().equals(estadoId)).toList();
        }
        if (limit > 0 && cells.size() > limit) {
            return cells.stream()
                    .sorted(Comparator.comparingDouble(PredictionCell::prioridad).reversed())
                    .limit(limit)
                    .toList();
        }
        return cells;
    }

    public ClustersResponse clusters() {
        return bundle().clusters();
    }

    public ModelReport report() {
        return bundle().report();
    }

    private ModelBundle train(DatasetSnapshot dataset) {
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

        List<Sample> samples = new ArrayList<>(catalog.allMunicipalities().size());
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
                double kernel = Math.exp(-0.5 * Math.pow(distance / KDE_BANDWIDTH_KM, 2));
                density += stateFosas.getOrDefault(state.id(), 0) * kernel;
            }
            densities.add(density);
            if (density > maxKde) {
                maxKde = density;
            }
        }

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
            double[] m3Features = Arrays.copyOf(features, M3_FEATURE_NAMES.size());
            m3Features[9] = Math.log1p(missingMunicipality);
            m3Features[10] = missingMunicipality / (Math.max(1, population) / 100_000.0);
            m3Features[11] = Math.log1p(missingState);
            m3Features[12] = missingState / (Math.max(1, state.poblacion()) / 100_000.0);
            double kde = maxKde > 0 ? densities.get(index) / maxKde : 0;
            int label = data.presence().getOrDefault(municipality.id(), 0);
            samples.add(new Sample(municipality, state, features, m3Features, label, kde, rate));
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

        Validation validation = validate(catalog, samples, matrix, matrixM3, labels);
        RandomForestClassifier forest = modelFactory.productionForest(SEED);
        forest.fit(matrix, labels);
        double[] probabilities = new double[samples.size()];
        for (int i = 0; i < samples.size(); i++) {
            probabilities[i] = forest.predictProba(matrix[i]);
        }
        RandomForestClassifier m3Forest = modelFactory.challengerForest(SEED + 7_919L);
        m3Forest.fit(matrixM3, labels);
        double[] m3Probabilities = new double[samples.size()];
        for (int i = 0; i < samples.size(); i++) {
            m3Probabilities[i] = m3Forest.predictProba(matrixM3[i]);
        }
        
        
        for (int i = 0; i < m3Probabilities.length; i++) {
            m3Probabilities[i] = validation.calibrator().calibrate(m3Probabilities[i]);
        }

        String selected = selectModel(validation);
        double[] rawScores = selectScores(selected, validation, probabilities, m3Probabilities, samples);
        double[] modelProbabilities = "m3".equals(selected) ? m3Probabilities : probabilities;
        double[] percentile = percentile(rawScores);

        KMeans.Result kmeans = cluster(samples);
        Map<Integer, ClusterProfile> clusterProfiles = clusterProfiles(samples, kmeans.labels());
        SpatialGraph.Result graph = SpatialGraph.build(catalog.allMunicipalities(), 6);
        Map<String, Integer> communityByMunicipality = new HashMap<>();
        for (int i = 0; i < catalog.allMunicipalities().size(); i++) {
            communityByMunicipality.put(catalog.allMunicipalities().get(i).id(), graph.community()[i]);
        }

        double medianRate = median(samples.stream().mapToDouble(Sample::rate).toArray());
        double medianPop = median(samples.stream().mapToDouble(s -> s.municipality().poblacion()).toArray());
        double medianBorder = median(samples.stream().mapToDouble(s -> s.features()[6]).toArray());

        List<PredictionCell> cells = new ArrayList<>(samples.size());
        for (int i = 0; i < samples.size(); i++) {
            Sample sample = samples.get(i);
            int cluster = kmeans.labels()[i];
            ClusterProfile profile = clusterProfiles.get(cluster);
            int community = communityByMunicipality.getOrDefault(sample.municipality().id(), 0);
            double priority = percentile[i];
            String band = priority >= 90 ? "A" : priority >= 70 ? "B" : "C";
            cells.add(new PredictionCell(
                    sample.municipality().id(),
                    sample.municipality().nombre(),
                    sample.municipality().estadoId(),
                    sample.state().nombre(),
                    sample.municipality().lat(),
                    sample.municipality().lon(),
                    sample.municipality().poblacion(),
                    sample.label(),
                    Math.round(sample.rate() * Math.max(1, sample.municipality().poblacion()) / 100_000.0 * 100.0) / 100.0,
                    Math.round(rawScores[i] * 1000.0) / 1000.0,
                    Math.round(modelProbabilities[i] * 1000.0) / 1000.0,
                    Math.round(sample.kde() * 1000.0) / 1000.0,
                    Math.round(priority * 10.0) / 10.0,
                    band,
                    cluster,
                    profile == null ? "Sin perfil" : profile.name(),
                    community,
                    factors(sample, medianRate, medianPop, medianBorder)));
        }
        cells = List.copyOf(cells);

        ModelReport report = new ModelReport(
                "Presencia documentada de fosas clandestinas por municipio (2006-2024)",
                dataset.version(),
                WARNING,
                selected,
                samples.size(),
                Arrays.stream(labels).sum(),
                Metrics.prevalence(labels),
                validation.models(selected),
                validation.folds(),
                importance("m3".equals(selected) ? m3Forest : forest,
                        "m3".equals(selected) ? M3_FEATURE_NAMES : FEATURE_NAMES),
                temporal(data));

        ClustersResponse clusters = new ClustersResponse(
                "K-means (k=5) sobre perfiles municipales + componentes conexas de un grafo kNN (k=6)",
                "Los grupos describen perfiles geográficos y de incidencia histórica. No son grupos delictivos, "
                        + "no identifican autores y no deben usarse para estigmatizar municipios.",
                clusterProfiles.values().stream()
                        .sorted(Comparator.comparingInt(ClusterProfile::id))
                        .map(profile -> new ClustersResponse.ClusterInfo(
                                profile.id(), profile.name(), profile.description(), profile.municipalities(),
                                profile.population(), round(profile.rate()), profile.topStates()))
                        .toList(),
                communities(catalog, graph));

        return new ModelBundle(dataset.version(), cells, report, clusters);
    }

    private Validation validate(Catalog catalog, List<Sample> samples, double[][] matrix,
                                double[][] matrixM3, int[] labels) {
        List<String> states = new ArrayList<>(catalog.states().keySet());
        Collections.shuffle(states, new Random(SEED));
        Map<String, Integer> foldOfState = new HashMap<>();
        for (int i = 0; i < states.size(); i++) {
            foldOfState.put(states.get(i), i % FOLDS);
        }

        double[] rfAuc = new double[FOLDS];
        double[] rfAp = new double[FOLDS];
        double[] rfPrecision = new double[FOLDS];
        double[] rfLift = new double[FOLDS];
        double[] rdBrier = new double[FOLDS];
        double[] m0Auc = new double[FOLDS];
        double[] m0Ap = new double[FOLDS];
        double[] m0Precision = new double[FOLDS];
        double[] m0Lift = new double[FOLDS];
        double[] m1Auc = new double[FOLDS];
        double[] m1Ap = new double[FOLDS];
        double[] m1Precision = new double[FOLDS];
        double[] m1Lift = new double[FOLDS];
        double[] m3Auc = new double[FOLDS];
        double[] m3Ap = new double[FOLDS];
        double[] m3Precision = new double[FOLDS];
        double[] m3Lift = new double[FOLDS];
        double[] m3Brier = new double[FOLDS];
        List<Double> calibrationScores = new ArrayList<>();
        List<Integer> calibrationLabels = new ArrayList<>();
        int[] counts = new int[FOLDS];
        List<FoldResult> folds = new ArrayList<>();

        for (int fold = 0; fold < FOLDS; fold++) {
            List<Integer> train = new ArrayList<>();
            List<Integer> test = new ArrayList<>();
            for (int i = 0; i < samples.size(); i++) {
                if (foldOfState.get(samples.get(i).state().id()) == fold) {
                    test.add(i);
                } else {
                    train.add(i);
                }
            }
            if (test.size() < 10) {
                continue;
            }
            double[][] trainX = new double[train.size()][];
            int[] trainY = new int[train.size()];
            for (int i = 0; i < train.size(); i++) {
                trainX[i] = matrix[train.get(i)];
                trainY[i] = labels[train.get(i)];
            }
            int[] testY = new int[test.size()];
            double[] m0 = new double[test.size()];
            double[] m1 = new double[test.size()];
            double[][] trainXM3 = new double[train.size()][];
            for (int i = 0; i < train.size(); i++) {
                trainXM3[i] = matrixM3[train.get(i)];
            }
            for (int i = 0; i < test.size(); i++) {
                Sample sample = samples.get(test.get(i));
                testY[i] = sample.label();
                m0[i] = sample.rate() * Math.max(1, sample.municipality().poblacion()) / 100_000.0;
                m1[i] = sample.kde();
            }
            int positives = Arrays.stream(testY).sum();
            if (positives == 0 || positives == testY.length) {
                continue;
            }

            RandomForestClassifier foldForest = modelFactory.validationForest(SEED + 31L * fold);
            foldForest.fit(trainX, trainY);
            double[] rf = new double[test.size()];
            for (int i = 0; i < test.size(); i++) {
                rf[i] = foldForest.predictProba(matrix[test.get(i)]);
            }
            RandomForestClassifier foldForestM3 = modelFactory.challengerForest(SEED + 919L + 31L * fold);
            foldForestM3.fit(trainXM3, trainY);
            double[] m3 = new double[test.size()];
            for (int i = 0; i < test.size(); i++) {
                m3[i] = foldForestM3.predictProba(matrixM3[test.get(i)]);
            }

            rfAuc[fold] = Metrics.auc(testY, rf);
            rfAp[fold] = Metrics.averagePrecision(testY, rf);
            rfPrecision[fold] = Metrics.precisionAt(testY, rf, 0.10);
            rfLift[fold] = Metrics.liftAt(testY, rf, 0.10);
            rdBrier[fold] = Metrics.brier(testY, rf);
            m0Auc[fold] = Metrics.auc(testY, m0);
            m0Ap[fold] = Metrics.averagePrecision(testY, m0);
            m0Precision[fold] = Metrics.precisionAt(testY, m0, 0.10);
            m0Lift[fold] = Metrics.liftAt(testY, m0, 0.10);
            m1Auc[fold] = Metrics.auc(testY, m1);
            m1Ap[fold] = Metrics.averagePrecision(testY, m1);
            m1Precision[fold] = Metrics.precisionAt(testY, m1, 0.10);
            m1Lift[fold] = Metrics.liftAt(testY, m1, 0.10);
            m3Auc[fold] = Metrics.auc(testY, m3);
            m3Ap[fold] = Metrics.averagePrecision(testY, m3);
            m3Precision[fold] = Metrics.precisionAt(testY, m3, 0.10);
            m3Lift[fold] = Metrics.liftAt(testY, m3, 0.10);
            m3Brier[fold] = Metrics.brier(testY, m3);
            for (int i = 0; i < m3.length; i++) {
                calibrationScores.add(m3[i]);
                calibrationLabels.add(testY[i]);
            }
            counts[fold] = 1;
            folds.add(new FoldResult(fold, test.size(), positives, rfAuc[fold], rfAp[fold],
                    rfPrecision[fold], rfLift[fold]));
        }

        int used = Arrays.stream(counts).sum();
        double[] calibrationScoreArray = new double[calibrationScores.size()];
        int[] calibrationLabelArray = new int[calibrationLabels.size()];
        for (int i = 0; i < calibrationScoreArray.length; i++) {
            calibrationScoreArray[i] = calibrationScores.get(i);
            calibrationLabelArray[i] = calibrationLabels.get(i);
        }
        IsotonicCalibrator calibrator = IsotonicCalibrator.fit(calibrationScoreArray, calibrationLabelArray);
        double calibratedBrier = 0;
        if (calibrationScoreArray.length > 0) {
            double sum = 0;
            for (int i = 0; i < calibrationScoreArray.length; i++) {
                double delta = calibrator.calibrate(calibrationScoreArray[i]) - calibrationLabelArray[i];
                sum += delta * delta;
            }
            calibratedBrier = sum / calibrationScoreArray.length;
        }
        return new Validation(
                used,
                average(rfAuc, used), average(rfAp, used), average(rfPrecision, used), average(rfLift, used),
                average(rdBrier, used),
                average(m0Auc, used), average(m0Ap, used), average(m0Precision, used), average(m0Lift, used),
                average(m1Auc, used), average(m1Ap, used), average(m1Precision, used), average(m1Lift, used),
                average(m3Auc, used), average(m3Ap, used), average(m3Precision, used), average(m3Lift, used),
                calibratedBrier,
                calibrator,
                List.copyOf(folds));
    }

    private String selectModel(Validation validation) {
        
        
        String selected = validation.m0Ap() >= validation.m1Ap() ? "m0" : "m1";
        double reference = Math.max(validation.m0Ap(), validation.m1Ap());
        if (validation.rfAp() > reference * 1.05) {
            selected = "m2";
            reference = validation.rfAp();
        }
        if (validation.m3Ap() > reference * 1.05) {
            selected = "m3";
        }
        return selected;
    }

    private double[] selectScores(String selected, Validation validation, double[] probabilities,
                                  double[] m3Probabilities, List<Sample> samples) {
        double[] scores = new double[samples.size()];
        if ("m0".equals(selected)) {
            double max = 0;
            for (int i = 0; i < samples.size(); i++) {
                Sample sample = samples.get(i);
                scores[i] = sample.rate() * Math.max(1, sample.municipality().poblacion()) / 100_000.0;
                max = Math.max(max, scores[i]);
            }
            if (max > 0) {
                for (int i = 0; i < scores.length; i++) {
                    scores[i] /= max;
                }
            }
        } else if ("m1".equals(selected)) {
            for (int i = 0; i < samples.size(); i++) {
                scores[i] = samples.get(i).kde();
            }
        } else if ("m3".equals(selected)) {
            System.arraycopy(m3Probabilities, 0, scores, 0, scores.length);
        } else {
            System.arraycopy(probabilities, 0, scores, 0, scores.length);
        }
        return scores;
    }

    private KMeans.Result cluster(List<Sample> samples) {
        double[][] raw = new double[samples.size()][5];
        for (int i = 0; i < samples.size(); i++) {
            Sample sample = samples.get(i);
            raw[i][0] = Math.log1p(sample.municipality().poblacion());
            raw[i][1] = sample.municipality().lat();
            raw[i][2] = sample.municipality().lon();
            raw[i][3] = sample.rate();
            raw[i][4] = sample.features()[6];
        }
        double[][] standardized = standardize(raw);
        return KMeans.fit(standardized, K_CLUSTERS, 100, SEED);
    }

    private Map<Integer, ClusterProfile> clusterProfiles(List<Sample> samples, int[] labels) {
        Map<Integer, List<Sample>> grouped = new LinkedHashMap<>();
        for (int i = 0; i < samples.size(); i++) {
            grouped.computeIfAbsent(labels[i], ignored -> new ArrayList<>()).add(samples.get(i));
        }
        double medianLogPop = median(samples.stream()
                .mapToDouble(s -> Math.log1p(s.municipality().poblacion())).toArray());

        record Raw(int id, List<Sample> group, double meanRate, double meanLogPop, double meanBorder,
                   double meanLat, long population) {
        }
        List<Raw> raws = new ArrayList<>();
        for (Map.Entry<Integer, List<Sample>> entry : grouped.entrySet()) {
            List<Sample> group = entry.getValue();
            raws.add(new Raw(
                    entry.getKey(),
                    group,
                    group.stream().mapToDouble(Sample::rate).average().orElse(0),
                    group.stream().mapToDouble(s -> Math.log1p(s.municipality().poblacion())).average().orElse(0),
                    group.stream().mapToDouble(s -> s.features()[6]).average().orElse(0),
                    group.stream().mapToDouble(s -> s.municipality().lat()).average().orElse(0),
                    group.stream().mapToLong(s -> Math.max(0, s.municipality().poblacion())).sum()));
        }
        raws.sort(Comparator.comparingDouble(Raw::meanRate).reversed());

        Map<Integer, ClusterProfile> profiles = new LinkedHashMap<>();
        for (int rank = 0; rank < raws.size(); rank++) {
            Raw raw = raws.get(rank);
            String name;
            if (rank == 0) {
                name = "Alta incidencia histórica";
            } else if (rank == 1) {
                name = "Incidencia media-alta";
            } else if (raw.meanBorder() < 300 && raw.meanLogPop() > medianLogPop) {
                name = "Frontera norte urbana";
            } else if (raw.meanLogPop() > medianLogPop) {
                name = "Áreas urbanas";
            } else if (raw.meanLat() < 19.5) {
                name = "Sur y sureste";
            } else {
                name = "Interior y bajío";
            }
            Map<String, Integer> stateCounts = new HashMap<>();
            for (Sample sample : raw.group()) {
                stateCounts.merge(sample.state().nombre(), 1, Integer::sum);
            }
            List<String> topStates = stateCounts.entrySet().stream()
                    .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                    .limit(4)
                    .map(Map.Entry::getKey)
                    .toList();
            String description = raw.group().size() + " municipios · "
                    + String.format(Locale.ROOT, "%.2f", raw.meanRate()) + " fosas por 100 mil · "
                    + String.format(Locale.ROOT, "%.0f", raw.meanBorder()) + " km promedio a la frontera";
            profiles.put(raw.id(), new ClusterProfile(
                    raw.id(), name, description, raw.group().size(), raw.population(), raw.meanRate(), topStates));
        }
        return profiles;
    }

    private List<ClustersResponse.CommunityInfo> communities(Catalog catalog, SpatialGraph.Result graph) {
        Map<Integer, Map<String, Integer>> counts = new HashMap<>();
        for (int i = 0; i < catalog.allMunicipalities().size(); i++) {
            Municipality municipality = catalog.allMunicipalities().get(i);
            State state = catalog.state(municipality.estadoId());
            counts.computeIfAbsent(graph.community()[i], ignored -> new HashMap<>())
                    .merge(state.nombre(), 1, Integer::sum);
        }
        List<ClustersResponse.CommunityInfo> result = new ArrayList<>();
        for (SpatialGraph.Community community : graph.top().stream().limit(20).toList()) {
            List<String> topStates = counts.getOrDefault(community.id(), Map.of()).entrySet().stream()
                    .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                    .limit(4)
                    .map(Map.Entry::getKey)
                    .toList();
            result.add(new ClustersResponse.CommunityInfo(
                    community.id(), community.municipios(), community.lat(), community.lon(), topStates));
        }
        return List.copyOf(result);
    }

    private Map<String, Double> importance(RandomForestClassifier forest, List<String> names) {
        double[] values = forest.importance();
        Map<String, Double> map = new LinkedHashMap<>();
        for (int i = 0; i < names.size(); i++) {
            map.put(names.get(i), Math.round(values[i] * 10_000.0) / 10_000.0);
        }
        return map;
    }

    private TemporalMetrics temporal(PredictionData data) {
        List<Double> actual = new ArrayList<>();
        List<Double> predicted = new ArrayList<>();
        int states = 0;
        for (Map.Entry<String, Map<Integer, Integer>> entry : data.fosasByStateYear().entrySet()) {
            Map<Integer, Integer> years = entry.getValue();
            if (years.keySet().containsAll(List.of(2012, 2013, 2014, 2015, 2016))) {
                states++;
                actual.add((double) years.get(2015));
                predicted.add((years.get(2012) + years.get(2013) + years.get(2014)) / 3.0);
                actual.add((double) years.get(2016));
                predicted.add((years.get(2013) + years.get(2014) + years.get(2015)) / 3.0);
            }
        }
        if (actual.isEmpty()) {
            return new TemporalMetrics(0, 0, 0, 0, 0, "Sin entidades con serie completa 2012-2016.");
        }
        double[] a = actual.stream().mapToDouble(Double::doubleValue).toArray();
        double[] p = predicted.stream().mapToDouble(Double::doubleValue).toArray();
        return new TemporalMetrics(states, a.length,
                round(Metrics.mae(a, p)), round(Metrics.rmse(a, p)), round(Metrics.spearman(a, p)),
                "Retrospectivo estatal 2015-2016 con persistencia del trienio previo. Sólo 13 entidades tienen "
                        + "serie completa; no sustituye una validación municipal ni prospectiva.");
    }

    private List<String> factors(Sample sample, double medianRate, double medianPop, double medianBorder) {
        List<String> factors = new ArrayList<>();
        if (sample.rate() > medianRate * 1.25) {
            factors.add("Tasa histórica alta en la entidad");
        }
        if (sample.municipality().poblacion() > Math.max(100_000, medianPop)) {
            factors.add("Municipio urbano");
        }
        if (sample.features()[6] < Math.min(250, medianBorder)) {
            factors.add("Cercanía a la frontera norte");
        }
        if (sample.features()[5] > 200) {
            factors.add("Periferia de la entidad");
        }
        if (factors.isEmpty()) {
            factors.add("Sin señal contextual dominante");
        }
        return List.copyOf(factors.subList(0, Math.min(2, factors.size())));
    }

    private double borderDistance(double lat, double lon) {
        double min = Double.POSITIVE_INFINITY;
        for (double[] point : BORDER_POINTS) {
            min = Math.min(min, Haversine.km(lat, lon, point[0], point[1]));
        }
        return min;
    }

    private double[] percentile(double[] scores) {
        Integer[] order = new Integer[scores.length];
        for (int i = 0; i < order.length; i++) {
            order[i] = i;
        }
        Arrays.sort(order, Comparator.comparingDouble(i -> scores[i]));
        double[] percentile = new double[scores.length];
        for (int rank = 0; rank < order.length; rank++) {
            percentile[order[rank]] = order.length == 1 ? 100 : 100.0 * rank / (order.length - 1);
        }
        return percentile;
    }

    private double[][] standardize(double[][] raw) {
        int n = raw.length;
        int d = raw[0].length;
        double[] mean = new double[d];
        double[] std = new double[d];
        for (double[] row : raw) {
            for (int j = 0; j < d; j++) {
                mean[j] += row[j];
            }
        }
        for (int j = 0; j < d; j++) {
            mean[j] /= n;
        }
        for (double[] row : raw) {
            for (int j = 0; j < d; j++) {
                double delta = row[j] - mean[j];
                std[j] += delta * delta;
            }
        }
        for (int j = 0; j < d; j++) {
            std[j] = Math.sqrt(std[j] / n);
            if (std[j] == 0) {
                std[j] = 1;
            }
        }
        double[][] result = new double[n][d];
        for (int i = 0; i < n; i++) {
            for (int j = 0; j < d; j++) {
                result[i][j] = (raw[i][j] - mean[j]) / std[j];
            }
        }
        return result;
    }

    private static double average(double[] values, int count) {
        if (count <= 0) {
            return 0;
        }
        double sum = 0;
        for (double value : values) {
            sum += value;
        }
        return sum / count;
    }

    private static double median(double[] values) {
        if (values.length == 0) {
            return 0;
        }
        double[] copy = values.clone();
        Arrays.sort(copy);
        int middle = copy.length / 2;
        return copy.length % 2 == 0 ? (copy[middle - 1] + copy[middle]) / 2 : copy[middle];
    }

    private static double round(double value) {
        return Math.round(value * 1000.0) / 1000.0;
    }

    public record ModelBundle(String version, List<PredictionCell> cells, ModelReport report,
                              ClustersResponse clusters) {
    }

    private record Sample(Municipality municipality, State state, double[] features, double[] m3Features,
                          int label, double kde, double rate) {
    }

    private record ClusterProfile(int id, String name, String description, int municipalities, long population,
                                  double rate, List<String> topStates) {
    }

    private record Validation(
            int foldsUsed,
            double rfAuc, double rfAp, double rfPrecision, double rfLift, double rfBrier,
            double m0Auc, double m0Ap, double m0Precision, double m0Lift,
            double m1Auc, double m1Ap, double m1Precision, double m1Lift,
            double m3Auc, double m3Ap, double m3Precision, double m3Lift, double m3Brier,
            IsotonicCalibrator calibrator,
            List<FoldResult> folds) {

        private List<ModelMetrics> models(String selected) {
            List<ModelMetrics> models = new ArrayList<>();
            models.add(new ModelMetrics("m0", "Persistencia histórica",
                    "Tasa de fosas de la entidad (2006-2016) × población municipal. Es el rival obligatorio.",
                    "m0".equals(selected), m0Auc, m0Ap, m0Precision, m0Lift, null));
            models.add(new ModelMetrics("m1", "KDE espacial",
                    "Densidad de fosas históricas con kernel gaussiano de 120 km desde los centroides estatales.",
                    "m1".equals(selected), m1Auc, m1Ap, m1Precision, m1Lift, null));
            models.add(new ModelMetrics("m2", "Random Forest",
                    "Clasificador de 180 árboles y 9 variables municipales/estatales; validación por entidad.",
                    "m2".equals(selected), rfAuc, rfAp, rfPrecision, rfLift, rfBrier));
            models.add(new ModelMetrics("m3", "Persistencia + historia M3",
                    "Random Forest regularizado (profundidad 5, hoja mínima 60) con historia municipal de "
                            + "desapariciones 2015-2024. 2025-2026 queda fuera del entrenamiento.",
                    "m3".equals(selected), m3Auc, m3Ap, m3Precision, m3Lift, m3Brier));
            return List.copyOf(models);
        }
    }
}
