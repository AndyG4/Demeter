package mx.rastro.shared.text;





public final class DamerauLevenshtein {

    private DamerauLevenshtein() {
    }

    public static int distance(String a, String b, int max) {
        if (a == null || b == null) {
            return max + 1;
        }
        int n = a.length();
        int m = b.length();
        if (Math.abs(n - m) > max) {
            return max + 1;
        }
        if (n == 0) {
            return m <= max ? m : max + 1;
        }
        if (m == 0) {
            return n <= max ? n : max + 1;
        }

        int[] prevPrev = new int[m + 1];
        int[] prev = new int[m + 1];
        int[] curr = new int[m + 1];
        for (int j = 0; j <= m; j++) {
            prev[j] = j;
        }

        for (int i = 1; i <= n; i++) {
            curr[0] = i;
            int rowMin = curr[0];
            char ca = a.charAt(i - 1);
            for (int j = 1; j <= m; j++) {
                char cb = b.charAt(j - 1);
                int cost = ca == cb ? 0 : 1;
                int value = Math.min(
                        Math.min(prev[j] + 1, curr[j - 1] + 1),
                        prev[j - 1] + cost);
                if (i > 1 && j > 1
                        && ca == b.charAt(j - 2)
                        && a.charAt(i - 2) == cb) {
                    value = Math.min(value, prevPrev[j - 2] + 1);
                }
                curr[j] = value;
                if (value < rowMin) {
                    rowMin = value;
                }
            }
            if (rowMin > max) {
                return max + 1;
            }
            int[] tmp = prevPrev;
            prevPrev = prev;
            prev = curr;
            curr = tmp;
        }
        int result = prev[m];
        return result <= max ? result : max + 1;
    }

    
    public static double similarity(String a, String b, int max) {
        int distance = distance(a, b, max);
        if (distance > max) {
            return 0.0;
        }
        int longest = Math.max(a.length(), b.length());
        return longest == 0 ? 1.0 : 1.0 - (double) distance / longest;
    }
}
