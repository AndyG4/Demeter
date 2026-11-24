package mx.rastro.shared.ratelimit;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;





@Component
public class TokenBucketRateLimiter {

    private static final long IDLE_NANOS = TimeUnit.MINUTES.toNanos(30);

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    public boolean tryAcquire(String key, int perMinute) {
        if (perMinute <= 0) {
            return true;
        }
        Bucket bucket = buckets.computeIfAbsent(key, ignored -> new Bucket(perMinute));
        return bucket.tryAcquire(perMinute, perMinute / 60.0);
    }

    @Scheduled(fixedDelay = 10 * 60 * 1000L)
    public void cleanup() {
        long now = System.nanoTime();
        buckets.entrySet().removeIf(entry -> now - entry.getValue().lastUsedNanos() > IDLE_NANOS);
    }

    int size() {
        return buckets.size();
    }

    private static final class Bucket {
        private double tokens;
        private long lastRefill;
        private long lastUsed;

        private Bucket(int capacity) {
            this.tokens = capacity;
            this.lastRefill = System.nanoTime();
            this.lastUsed = lastRefill;
        }

        private synchronized boolean tryAcquire(int capacity, double perSecond) {
            long now = System.nanoTime();
            double elapsed = Math.max(0, now - lastRefill) / 1_000_000_000.0;
            tokens = Math.min(capacity, tokens + elapsed * perSecond);
            lastRefill = now;
            lastUsed = now;
            if (tokens >= 1.0) {
                tokens -= 1.0;
                return true;
            }
            return false;
        }

        private synchronized long lastUsedNanos() {
            return lastUsed;
        }
    }
}
