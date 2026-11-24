package mx.rastro.shared.util;

import java.util.SplittableRandom;







public final class ApproximateLocation {

    private static final double MIN_RADIUS_DEG = 0.008;
    private static final double MAX_RADIUS_DEG = 0.026;

    private ApproximateLocation() {
    }

    public static double[] around(String recordId, double municipalityLat, double municipalityLon) {
        if (!Double.isFinite(municipalityLat) || !Double.isFinite(municipalityLon)
                || municipalityLat == 0 || municipalityLon == 0) {
            return new double[]{0, 0};
        }
        long seed = (recordId == null ? 0 : recordId.hashCode()) * 0x9E3779B97F4A7C15L;
        SplittableRandom random = new SplittableRandom(seed);
        double radius = MIN_RADIUS_DEG + random.nextDouble() * (MAX_RADIUS_DEG - MIN_RADIUS_DEG);
        double angle = random.nextDouble() * Math.PI * 2;
        double lat = municipalityLat + Math.sin(angle) * radius;
        double lon = municipalityLon + Math.cos(angle) * radius * 1.15;
        return new double[]{lat, lon};
    }
}
