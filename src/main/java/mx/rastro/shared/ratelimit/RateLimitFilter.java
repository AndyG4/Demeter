package mx.rastro.shared.ratelimit;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import mx.rastro.shared.config.RastroProperties;
import mx.rastro.shared.web.RequestIdFilter;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;





@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class RateLimitFilter extends OncePerRequestFilter {

    private final TokenBucketRateLimiter limiter;
    private final RastroProperties properties;

    public RateLimitFilter(TokenBucketRateLimiter limiter, RastroProperties properties) {
        this.limiter = limiter;
        this.properties = properties;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        boolean search = path.startsWith("/api/v1/search");
        int limit = search
                ? properties.getSearchRateLimitPerMinute()
                : properties.getRateLimitPerMinute();
        String tier = search ? "search" : "general";
        String ip = clientIp(request);
        if (!limiter.tryAcquire(tier + ":" + ip, limit)) {
            response.setStatus(429);
            response.setContentType("application/json;charset=UTF-8");
            response.setHeader("Retry-After", "60");
            response.setHeader("X-RateLimit-Limit", Integer.toString(limit));
            String requestId = String.valueOf(request.getAttribute(RequestIdFilter.ATTRIBUTE));
            response.getWriter().write("{\"code\":\"limite_excedido\",\"message\":\"Demasiadas solicitudes. "
                    + "Espera un minuto antes de volver a intentar.\",\"requestId\":\"" + requestId + "\"}");
            return;
        }
        response.setHeader("X-RateLimit-Limit", Integer.toString(limit));
        chain.doFilter(request, response);
    }

    private String clientIp(HttpServletRequest request) {
        if (properties.isTrustForwarded()) {
            String forwarded = request.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) {
                String first = forwarded.split(",")[0].trim();
                if (first.matches("[0-9a-fA-F:.]{2,64}")) {
                    return first;
                }
            }
        }
        return request.getRemoteAddr();
    }
}
