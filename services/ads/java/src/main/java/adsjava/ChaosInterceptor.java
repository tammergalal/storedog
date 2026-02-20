package adsjava;

import org.springframework.web.servlet.HandlerInterceptor;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Injects configurable latency and error responses to simulate chaos
 * for observability demos. Controlled via environment variables:
 * <ul>
 *   <li>{@code SERVICE_ERROR_RATE} — fraction 0.0–1.0 of requests to fail (default: 0.0)</li>
 *   <li>{@code SERVICE_DELAY_MS}   — fixed delay in milliseconds (default: 0)</li>
 *   <li>{@code SERVICE_CHAOS_MODE} — if "true", randomises both delay (0–2 s) and error rate</li>
 * </ul>
 */
public class ChaosInterceptor implements HandlerInterceptor {

    private static final double ERROR_RATE;
    private static final int DELAY_MS;
    private static final boolean CHAOS_MODE;

    static {
        String rate = System.getenv("SERVICE_ERROR_RATE");
        double parsedRate = 0.0;
        if (rate != null) {
            try { parsedRate = Double.parseDouble(rate); } catch (NumberFormatException ignored) {}
        }
        ERROR_RATE = parsedRate;

        String delay = System.getenv("SERVICE_DELAY_MS");
        int parsedDelay = 0;
        if (delay != null) {
            try { parsedDelay = Integer.parseInt(delay); } catch (NumberFormatException ignored) {}
        }
        DELAY_MS = parsedDelay;

        String chaos = System.getenv("SERVICE_CHAOS_MODE");
        CHAOS_MODE = "true".equalsIgnoreCase(chaos);
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        int delay = CHAOS_MODE ? ThreadLocalRandom.current().nextInt(0, 2001) : DELAY_MS;
        double errorRate = CHAOS_MODE ? Math.random() : ERROR_RATE;
        if (delay > 0) {
            Thread.sleep(delay);
        }
        if (Math.random() < errorRate) {
            response.setStatus(500);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"chaos injection\"}");
            return false;
        }
        return true;
    }
}
