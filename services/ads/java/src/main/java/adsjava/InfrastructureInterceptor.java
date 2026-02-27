package adsjava;

import org.springframework.web.servlet.HandlerInterceptor;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Applies per-request latency and availability behaviour driven by environment
 * configuration. Enables realistic infrastructure degradation scenarios for
 * observability labs without modifying application code.
 *
 * <ul>
 *   <li>{@code CAMPAIGN_FETCH_FAILURE_RATE} — fraction 0.0–1.0 of requests to fail (default: 0.0)</li>
 *   <li>{@code CAMPAIGN_DB_QUERY_LATENCY_MS} — fixed latency in milliseconds (default: 0)</li>
 *   <li>{@code CAMPAIGN_SERVICE_DEGRADED}    — if "true", randomises both latency and failure rate</li>
 * </ul>
 */
public class InfrastructureInterceptor implements HandlerInterceptor {

    private static final double ERROR_RATE;
    private static final int DELAY_MS;
    private static final boolean DEGRADED_MODE;

    static {
        String rate = System.getenv("CAMPAIGN_FETCH_FAILURE_RATE");
        double parsedRate = 0.0;
        if (rate != null) {
            try { parsedRate = Double.parseDouble(rate); } catch (NumberFormatException ignored) {}
        }
        ERROR_RATE = parsedRate;

        String delay = System.getenv("CAMPAIGN_DB_QUERY_LATENCY_MS");
        int parsedDelay = 0;
        if (delay != null) {
            try { parsedDelay = Integer.parseInt(delay); } catch (NumberFormatException ignored) {}
        }
        DELAY_MS = parsedDelay;

        String degraded = System.getenv("CAMPAIGN_SERVICE_DEGRADED");
        DEGRADED_MODE = "true".equalsIgnoreCase(degraded);
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        int delay = DEGRADED_MODE ? ThreadLocalRandom.current().nextInt(0, 2001) : DELAY_MS;
        double errorRate = DEGRADED_MODE ? Math.random() : ERROR_RATE;
        if (delay > 0) {
            Thread.sleep(delay);
        }
        if (Math.random() < errorRate) {
            response.setStatus(503);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Campaign data temporarily unavailable\"}");
            return false;
        }
        return true;
    }
}
