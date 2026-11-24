package mx.rastro.shared.config;

import org.springframework.boot.context.properties.ConfigurationProperties;





@ConfigurationProperties(prefix = "rastro")
public class RastroProperties {

    
    private String dataDir = "./data";
    
    private boolean demoEnabled = true;
    
    private int searchMaxResults = 100;
    private int searchMinChars = 3;
    private int searchMaxChars = 80;
    
    private int rateLimitPerMinute = 120;
    
    private int searchRateLimitPerMinute = 30;
    
    private boolean trustForwarded = false;
    
    private boolean autoRefresh = true;
    private int refreshSeconds = 300;

    public String getDataDir() {
        return dataDir;
    }

    public void setDataDir(String dataDir) {
        this.dataDir = dataDir;
    }

    public boolean isDemoEnabled() {
        return demoEnabled;
    }

    public void setDemoEnabled(boolean demoEnabled) {
        this.demoEnabled = demoEnabled;
    }

    public int getSearchMaxResults() {
        return searchMaxResults;
    }

    public void setSearchMaxResults(int searchMaxResults) {
        this.searchMaxResults = Math.max(1, Math.min(100, searchMaxResults));
    }

    public int getSearchMinChars() {
        return searchMinChars;
    }

    public void setSearchMinChars(int searchMinChars) {
        this.searchMinChars = Math.max(3, Math.min(10, searchMinChars));
    }

    public int getSearchMaxChars() {
        return searchMaxChars;
    }

    public void setSearchMaxChars(int searchMaxChars) {
        this.searchMaxChars = Math.max(20, Math.min(120, searchMaxChars));
    }

    public int getRateLimitPerMinute() {
        return rateLimitPerMinute;
    }

    public void setRateLimitPerMinute(int rateLimitPerMinute) {
        this.rateLimitPerMinute = Math.max(10, Math.min(10_000, rateLimitPerMinute));
    }

    public int getSearchRateLimitPerMinute() {
        return searchRateLimitPerMinute;
    }

    public void setSearchRateLimitPerMinute(int searchRateLimitPerMinute) {
        this.searchRateLimitPerMinute = Math.max(5, Math.min(1_000, searchRateLimitPerMinute));
    }

    public boolean isTrustForwarded() {
        return trustForwarded;
    }

    public void setTrustForwarded(boolean trustForwarded) {
        this.trustForwarded = trustForwarded;
    }

    public boolean isAutoRefresh() {
        return autoRefresh;
    }

    public void setAutoRefresh(boolean autoRefresh) {
        this.autoRefresh = autoRefresh;
    }

    public int getRefreshSeconds() {
        return refreshSeconds;
    }

    public void setRefreshSeconds(int refreshSeconds) {
        this.refreshSeconds = Math.max(30, refreshSeconds);
    }
}
