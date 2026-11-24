package mx.rastro.features.search;

import mx.rastro.features.dataset.DatasetService;
import mx.rastro.features.dataset.DatasetSnapshot;
import mx.rastro.features.records.PersonRecord;
import mx.rastro.shared.text.SpanishPhonetic;
import mx.rastro.shared.text.TextNormalizer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Predicate;









@Component
public class SearchIndex {

    private static final Logger log = LoggerFactory.getLogger(SearchIndex.class);
    private static final int MAX_POSTINGS_PER_KEY = 20_000;
    private static final int MAX_CANDIDATES = 4_000;
    private static final int TRIGRAM_LIMIT = 80_000;

    private final AtomicReference<IndexSnapshot> current = new AtomicReference<>();
    private final Object lock = new Object();
    private final DatasetService datasetService;

    public SearchIndex(DatasetService datasetService) {
        this.datasetService = datasetService;
    }

    @org.springframework.context.event.EventListener(org.springframework.boot.context.event.ApplicationReadyEvent.class)
    public void warmUp() {
        try {
            ensure(datasetService.snapshot());
        } catch (RuntimeException ex) {
            log.warn("No fue posible precalentar el índice: {}", ex.getMessage());
        }
    }

    @org.springframework.context.event.EventListener
    public void onDatasetChanged(mx.rastro.features.dataset.DatasetChangedEvent event) {
        try {
            ensure(event.snapshot());
        } catch (RuntimeException ex) {
            log.warn("No fue posible reconstruir el índice tras la actualización: {}", ex.getMessage());
        }
    }

    public IndexSnapshot ensure(DatasetSnapshot dataset) {
        IndexSnapshot snapshot = current.get();
        if (snapshot != null && snapshot.version().equals(dataset.version())) {
            return snapshot;
        }
        synchronized (lock) {
            snapshot = current.get();
            if (snapshot != null && snapshot.version().equals(dataset.version())) {
                return snapshot;
            }
            long start = System.nanoTime();
            IndexSnapshot built = build(dataset);
            current.set(built);
            log.info("Índice construido en {} ms ({} registros, trigramas={})",
                    (System.nanoTime() - start) / 1_000_000, dataset.searchRecords().size(), built.withTrigrams());
            return built;
        }
    }

    public SearchResult search(DatasetSnapshot dataset, String normalizedQuery, int limit,
                               Predicate<PersonRecord> filter) {
        return search(dataset, normalizedQuery, limit, 0, filter);
    }

    public SearchResult search(DatasetSnapshot dataset, String normalizedQuery, int limit, int offset,
                               Predicate<PersonRecord> filter) {
        IndexSnapshot index = ensure(dataset);
        List<String> queryTokens = TextNormalizer.tokens(normalizedQuery);
        if (queryTokens.isEmpty() || limit <= 0) {
            return new SearchResult(List.of(), 0);
        }
        int safeOffset = Math.max(0, Math.min(offset, 2_000));
        int keep = Math.min(2_000, limit + safeOffset);

        int[] counts = new int[index.size()];
        boolean[] touched = new boolean[index.size()];
        List<Integer> candidates = new ArrayList<>();
        int[] added = new int[1];
        for (String token : queryTokens) {
            for (String variant : FuzzyMatcher.variants(token)) {
                collect(index.tokenIndex().get(variant), counts, touched, candidates, 8, added);
                collect(index.phoneticIndex().get(SpanishPhonetic.key(variant)), counts, touched, candidates, 2, added);
            }
            if (index.withTrigrams()) {
                for (String trigram : trigrams(token)) {
                    collect(index.trigramIndex().get(trigram), counts, touched, candidates, 1, added);
                }
            }
        }

        
        
        if (candidates.size() < 12) {
            for (int i = 0; i < index.size(); i++) {
                if (!touched[i]) {
                    touched[i] = true;
                    counts[i] = 1;
                    candidates.add(i);
                }
            }
        }

        List<Integer> pool = candidates;
        if (pool.size() > MAX_CANDIDATES) {
            PriorityQueue<Integer> top = new PriorityQueue<>(MAX_CANDIDATES + 1,
                    Comparator.comparingInt(i -> counts[i]));
            for (int candidate : pool) {
                top.offer(candidate);
                if (top.size() > MAX_CANDIDATES) {
                    top.poll();
                }
            }
            pool = new ArrayList<>(top);
        }

        PriorityQueue<Scored> best = new PriorityQueue<>(Comparator.comparingDouble(Scored::score));
        int matched = 0;
        for (int candidate : pool) {
            PersonRecord record = index.records().get(candidate);
            if (filter != null && !filter.test(record)) {
                continue;
            }
            double score = FuzzyMatcher.score(queryTokens, index.tokens().get(candidate));
            if (index.normalizedNames().get(candidate).equals(normalizedQuery)) {
                score = 1.0;
            }
            if (score < 0.66) {
                continue;
            }
            matched++;
            best.offer(new Scored(candidate, score));
            if (best.size() > keep) {
                best.poll();
            }
        }

        List<Scored> ordered = new ArrayList<>(best);
        ordered.sort(Comparator.comparingDouble(Scored::score).reversed()
                .thenComparingInt(Scored::index));
        int from = Math.min(safeOffset, ordered.size());
        int to = Math.min(ordered.size(), from + limit);
        List<ScoredRecord> hits = new ArrayList<>(to - from);
        for (Scored scored : ordered.subList(from, to)) {
            hits.add(new ScoredRecord(index.records().get(scored.index()), scored.score()));
        }
        return new SearchResult(List.copyOf(hits), matched);
    }

    private void collect(Postings postings, int[] counts, boolean[] touched, List<Integer> candidates,
                         int weight, int[] added) {
        if (postings == null) {
            return;
        }
        int[] values = postings.values();
        for (int i = 0; i < postings.size(); i++) {
            int record = values[i];
            if (!touched[record]) {
                touched[record] = true;
                candidates.add(record);
            }
            counts[record] += weight;
            added[0]++;
        }
    }

    private IndexSnapshot build(DatasetSnapshot dataset) {
        List<PersonRecord> records = dataset.searchRecords();
        int size = records.size();
        boolean withTrigrams = size <= TRIGRAM_LIMIT;
        Map<String, Postings> tokenIndex = new HashMap<>();
        Map<String, Postings> phoneticIndex = new HashMap<>();
        Map<String, Postings> trigramIndex = new HashMap<>();
        List<List<String>> tokens = new ArrayList<>(size);
        List<String> normalizedNames = new ArrayList<>(size);

        for (int i = 0; i < size; i++) {
            PersonRecord record = records.get(i);
            String normalized = record.nombreNormalizado();
            normalizedNames.add(normalized);
            List<String> recordTokens = TextNormalizer.tokens(normalized);
            tokens.add(recordTokens);
            Set<String> seen = new HashSet<>();
            for (String token : recordTokens) {
                if (token.length() < 2) {
                    continue;
                }
                if (seen.add("t:" + token)) {
                    add(tokenIndex, token, i);
                }
                if (seen.add("p:" + token)) {
                    add(phoneticIndex, SpanishPhonetic.key(token), i);
                }
                if (withTrigrams) {
                    for (String trigram : trigrams(token)) {
                        if (seen.add("g:" + trigram)) {
                            add(trigramIndex, trigram, i);
                        }
                    }
                }
            }
        }
        return new IndexSnapshot(dataset.version(), records, tokens, normalizedNames,
                tokenIndex, phoneticIndex, trigramIndex, withTrigrams);
    }

    private void add(Map<String, Postings> index, String key, int record) {
        if (key == null || key.isEmpty()) {
            return;
        }
        Postings postings = index.computeIfAbsent(key, ignored -> new Postings());
        if (postings.size() < MAX_POSTINGS_PER_KEY) {
            postings.add(record);
        }
    }

    private static List<String> trigrams(String token) {
        String padded = "#" + token + "#";
        List<String> result = new ArrayList<>(Math.max(1, padded.length() - 2));
        for (int i = 0; i + 3 <= padded.length(); i++) {
            result.add(padded.substring(i, i + 3));
        }
        return result;
    }

    public record ScoredRecord(PersonRecord record, double score) {
    }

    private record Scored(int index, double score) {
    }

    public record SearchResult(List<ScoredRecord> hits, int matched) {
    }

    public record IndexSnapshot(
            String version,
            List<PersonRecord> records,
            List<List<String>> tokens,
            List<String> normalizedNames,
            Map<String, Postings> tokenIndex,
            Map<String, Postings> phoneticIndex,
            Map<String, Postings> trigramIndex,
            boolean withTrigrams) {

        public int size() {
            return records.size();
        }
    }

    
    public static final class Postings {
        private int[] data = new int[8];
        private int size;

        public void add(int value) {
            if (size == data.length) {
                int[] grown = new int[data.length * 2];
                System.arraycopy(data, 0, grown, 0, data.length);
                data = grown;
            }
            data[size++] = value;
        }

        public int[] values() {
            return data;
        }

        public int size() {
            return size;
        }
    }
}
