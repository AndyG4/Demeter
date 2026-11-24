package mx.rastro.features.predictions.ml;

import mx.rastro.features.catalog.Municipality;
import mx.rastro.shared.util.Haversine;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.PriorityQueue;






public final class SpatialGraph {

    private SpatialGraph() {
    }

    public record Result(int[] community, int communities, List<Community> top) {
    }

    public record Community(int id, int municipios, double lat, double lon) {
    }

    public static Result build(List<Municipality> municipalities, int k) {
        int n = municipalities.size();
        int neighbours = Math.max(2, Math.min(k, n - 1));
        boolean[][] mutual = new boolean[n][n];
        for (int i = 0; i < n; i++) {
            Municipality origin = municipalities.get(i);
            PriorityQueue<Neighbour> nearest = new PriorityQueue<>(
                    Comparator.comparingDouble(Neighbour::distance).reversed());
            for (int j = 0; j < n; j++) {
                if (i == j) {
                    continue;
                }
                Municipality target = municipalities.get(j);
                double distance = Haversine.km(origin.lat(), origin.lon(), target.lat(), target.lon());
                nearest.offer(new Neighbour(j, distance));
                if (nearest.size() > neighbours) {
                    nearest.poll();
                }
            }
            for (Neighbour neighbour : nearest) {
                mutual[i][neighbour.index()] = true;
            }
        }

        int[] parent = new int[n];
        for (int i = 0; i < n; i++) {
            parent[i] = i;
        }
        for (int i = 0; i < n; i++) {
            for (int j = i + 1; j < n; j++) {
                if (mutual[i][j] && mutual[j][i]) {
                    union(parent, i, j);
                }
            }
        }

        int[] raw = new int[n];
        for (int i = 0; i < n; i++) {
            raw[i] = find(parent, i);
        }
        List<Integer> roots = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            if (raw[i] == i) {
                roots.add(i);
            }
        }
        roots.sort(Comparator.comparingInt(root -> -size(raw, root)));

        int[] mapping = new int[n];
        java.util.Arrays.fill(mapping, -1);
        int next = 0;
        List<Community> top = new ArrayList<>();
        for (int root : roots) {
            int count = size(raw, root);
            double lat = 0;
            double lon = 0;
            for (int i = 0; i < n; i++) {
                if (raw[i] == root) {
                    mapping[i] = next;
                    lat += municipalities.get(i).lat();
                    lon += municipalities.get(i).lon();
                }
            }
            if (count > 0) {
                top.add(new Community(next, count, lat / count, lon / count));
            }
            next++;
        }
        top.sort(Comparator.comparingInt(Community::municipios).reversed());
        int[] labels = new int[n];
        for (int i = 0; i < n; i++) {
            labels[i] = Math.max(0, mapping[i]);
        }
        return new Result(labels, next, List.copyOf(top));
    }

    private static int size(int[] parent, int root) {
        int count = 0;
        for (int value : parent) {
            if (value == root) {
                count++;
            }
        }
        return count;
    }

    private static int find(int[] parent, int value) {
        int root = value;
        while (parent[root] != root) {
            root = parent[root];
        }
        while (parent[value] != value) {
            int next = parent[value];
            parent[value] = root;
            value = next;
        }
        return root;
    }

    private static void union(int[] parent, int a, int b) {
        int rootA = find(parent, a);
        int rootB = find(parent, b);
        if (rootA != rootB) {
            parent[rootB] = rootA;
        }
    }

    private record Neighbour(int index, double distance) {
    }
}
